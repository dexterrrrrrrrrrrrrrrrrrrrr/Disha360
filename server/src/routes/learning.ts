import { staffScope } from "../services/staffScope.js";
import { raw, Router, type RequestHandler, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { databaseStatus } from "../config/database.js";
import {
  requireAuth,
  requireRole,
  protectMutations,
} from "../middleware/auth.js";
import { LearningModule } from "../models/LearningModule.js";
import { LearningProgress } from "../models/Preparation.js";
import {
  learningInput,
  learningUpdate,
  publishInput,
} from "../validators/learning.js";
import { objectIdSchema } from "../validators/resume.js";
import { AppError } from "../utils/AppError.js";
import { progressDTO } from "../services/learningProgress.js";
import { recordActivity } from "../services/activity.js";
const pdfBytes = 2 * 1024 * 1024;
const pdfsPerModule = 3;
const pdfUpload = raw({ type: "application/pdf", limit: pdfBytes, inflate: false });
const pdfVersion = z.object({ version: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER) }).strict();

function pdfName(header: string | undefined) {
  try {
    const name = decodeURIComponent(header ?? "");
    if (name.length <= 180 && !/[\x00-\x1f\x7f/\\]/.test(name) && /\.pdf$/i.test(name)) {
      const base = name.slice(0, -4).replace(/[^A-Za-z0-9._ -]/g, "-").trim().replace(/^\.+/, "");
      return (base.slice(0, 100).trim() || "lesson") + ".pdf";
    }
  } catch { /* Malformed filename. */ }
  throw new AppError(400, "INVALID_PDF_NAME", "Choose a file with a .pdf extension.");
}

function hasPdfMarkers(bytes: Buffer) {
  // Check framing only. Uploaded PDFs are never rendered or executed by Disha360.
  return /^%PDF-(?:1\.[0-7]|2\.0)(?:\r|\n)/.test(bytes.subarray(0, 12).toString("latin1")) &&
    /(?:\r|\n)%%EOF[ \t\r\n\f]*$/.test(bytes.subarray(-1024).toString("latin1"));
}

async function sendLessonPdf(filter: object, lessonId: string, res: Response) {
  const module = await LearningModule.findOne({
    ...filter,
    lessons: { $elemMatch: { _id: lessonId, "pdf.name": { $exists: true } } },
  }).select("+pdfFiles");
  const meta = module?.lessons.id(lessonId)?.pdf;
  const bytes = module?.pdfFiles?.get(lessonId);
  if (!meta?.name || !bytes || bytes.length !== meta.size)
    throw new AppError(404, "NOT_FOUND", "PDF not found.");
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${meta.name}"`,
    "Content-Security-Policy": "sandbox; default-src 'none'",
  }).send(bytes);
}

export function moduleDTO(m: InstanceType<typeof LearningModule>) {
  return {
    id: m.id,
    title: m.title,
    subject: m.subject,
    topic: m.topic,
    description: m.description,
    objectives: m.objectives,
    lessons: m.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      kind: l.kind,
      body: l.body,
      url: l.url,
      ...(l.pdf?.name ? { pdf: { name: l.pdf.name, size: l.pdf.size } } : {}),
    })),
    published: m.published,
    version: m.version,
    updatedAt: m.updatedAt,
  };
}
export function learningRoutes(origin: string, status = databaseStatus) {
  const r = Router();
  r.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  r.use(protectMutations(origin));
  r.use((_req, _res, next) => {
    if (status() !== "connected")
      throw new AppError(
        503,
        "DATABASE_UNAVAILABLE",
        "The database is unavailable.",
      );
    next();
  });
  r.use(requireAuth);
  const staff = requireRole("trainer", "admin");
  const student = requireRole("student");
  const owned = async (id: unknown, user: { id?: unknown; role: string }) => {
    const m = await LearningModule.findOne({
      _id: objectIdSchema.parse(id),
      ...(user.role === "admin" ? {} : { ownerId: user.id }),
    });
    if (!m) throw new AppError(404, "NOT_FOUND", "Learning module not found.");
    return m;
  };
  r.get("/config", (_req, res) =>
    res.json({
      success: true,
      data: {
        uploadsConfigured: true,
        pdfBytes,
        pdfsPerModule,
      },
    }),
  );
  r.get("/manage/modules", staff, async (req, res) => {
    const modules = await LearningModule.find(
      req.user!.role === "admin" ? {} : { ownerId: req.user!._id },
    )
      .sort({ updatedAt: -1 })
      .limit(100);
    res.json({ success: true, data: { modules: modules.map(moduleDTO) } });
  });
  r.post("/manage/modules", staff, async (req, res) => {
    const input = learningInput.parse(req.body);
    if (input.lessons.some((l) => l.id))
      throw new AppError(
        400,
        "INVALID_LESSON",
        "New lessons must not provide existing IDs.",
      );
    const m = await LearningModule.create({ ...input, ownerId: req.user!._id });
    res.status(201).json({ success: true, data: { module: moduleDTO(m) } });
  });
  r.get("/manage/modules/:id", staff, async (req, res) =>
    res.json({
      success: true,
      data: { module: moduleDTO(await owned(req.params.id, req.user!)) },
    }),
  );
  r.put("/manage/modules/:id", staff, async (req, res) => {
    const input = learningUpdate.parse(req.body);
    const m = await owned(req.params.id, req.user!);
    const ids = input.lessons.filter((l) => l.id).map((l) => l.id!);
    if (
      new Set(ids).size !== ids.length ||
      ids.some((id) => !m.lessons.some((l) => l.id === id))
    )
      throw new AppError(
        400,
        "INVALID_LESSON",
        "Lesson IDs must be distinct and belong to this module.",
      );
    if (m.published && !input.lessons.length)
      throw new AppError(
        400,
        "EMPTY_MODULE",
        "Published modules must contain lessons.",
      );
    const { version, ...fields } = input;
    const removedPdfKeys = Object.fromEntries(m.lessons
      .filter((lesson) => lesson.pdf && !ids.includes(lesson.id))
      .map((lesson) => [`pdfFiles.${lesson.id}`, 1]));
    const saved = await LearningModule.findOneAndUpdate(
      {
        _id: m._id,
        version,
        ...(req.user!.role === "admin" ? {} : { ownerId: req.user!._id }),
      },
      {
        $set: {
          ...fields,
          lessons: input.lessons.map(({ id, ...l }) => ({
            ...l,
            ...(id ? { _id: id, pdf: m.lessons.id(id)?.pdf } : {}),
          })),
        },
        $inc: { version: 1 },
        ...(Object.keys(removedPdfKeys).length ? { $unset: removedPdfKeys } : {}),
      },
      { new: true, runValidators: true },
    );
    if (!saved)
      throw new AppError(
        409,
        "MODULE_CONFLICT",
        "Module changed in another tab. Reload before saving.",
      );
    res.json({ success: true, data: { module: moduleDTO(saved) } });
  });
  const pdfPath = "/manage/modules/:id/lessons/:lessonId/pdf";
  const staffFilter = (id: unknown, user: { _id: unknown; role: string }) => ({
    _id: objectIdSchema.parse(id),
    ...(user.role === "admin" ? {} : { ownerId: user._id }),
  });
  r.get(pdfPath, staff, async (req, res) => {
    await sendLessonPdf(staffFilter(req.params.id, req.user!), objectIdSchema.parse(req.params.lessonId).toLowerCase(), res);
  });

  const uploadLimit = rateLimit({
    windowMs: 60_000,
    limit: 6,
    keyGenerator: (req) => req.user!.id,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, error: { code: "PDF_UPLOAD_LIMIT", message: "Please wait a minute before uploading more PDFs." } },
  });
  const validateUpload: RequestHandler = async (req, _res, next) => {
    await owned(req.params.id, req.user!);
    if (!req.is("application/pdf") || (req.get("Content-Encoding") ?? "identity") !== "identity")
      throw new AppError(415, "PDF_REQUIRED", "Upload an uncompressed PDF file.");
    next();
  };
  const savePdf = (remove: boolean): RequestHandler => async (req, res) => {
    const { version } = pdfVersion.parse(req.query);
    const lessonId = objectIdSchema.parse(req.params.lessonId).toLowerCase();
    const module = await owned(req.params.id, req.user!);
    const lesson = module.lessons.id(lessonId);
    if (!lesson || (remove && !lesson.pdf))
      throw new AppError(404, "NOT_FOUND", "Lesson or PDF not found.");
    if (module.version !== version)
      throw new AppError(409, "MODULE_CONFLICT", "Module changed in another tab. Reload before editing PDFs.");
    const fileKey = `pdfFiles.${lessonId}`;
    let change;
    if (remove) {
      change = { $unset: { "lessons.$.pdf": 1, [fileKey]: 1 } };
    } else {
      const name = pdfName(req.get("X-Disha360-Filename"));
      if (!Buffer.isBuffer(req.body) || !hasPdfMarkers(req.body))
        throw new AppError(400, "INVALID_PDF", "Choose a valid PDF file.");
      if (!lesson.pdf && module.lessons.filter((item) => item.pdf).length >= pdfsPerModule)
        throw new AppError(409, "MODULE_PDF_LIMIT", "This module already has three PDFs. Remove one before adding another.");
      change = { $set: { "lessons.$.pdf": { name, size: req.body.length }, [fileKey]: req.body } };
    }
    const saved = await LearningModule.findOneAndUpdate(
      { ...staffFilter(req.params.id, req.user!), version, "lessons._id": lessonId },
      { ...change, $inc: { version: 1 } },
      { new: true, runValidators: true },
    );
    if (!saved)
      throw new AppError(409, "MODULE_CONFLICT", "Module changed in another tab. Reload before editing PDFs.");
    res.json({ success: true, data: { module: moduleDTO(saved) } });
  };
  r.put(pdfPath, staff, uploadLimit, validateUpload, pdfUpload, savePdf(false));
  r.delete(pdfPath, staff, savePdf(true));

  r.post("/manage/modules/:id/publication", staff, async (req, res) => {
    const input = publishInput.parse(req.body);
    const m = await owned(req.params.id, req.user!);
    if (input.published && !m.lessons.length)
      throw new AppError(400, "EMPTY_MODULE", "Add lessons before publishing.");
    const saved = await LearningModule.findOneAndUpdate(
      {
        _id: m._id,
        version: input.version,
        ...(req.user!.role === "admin" ? {} : { ownerId: req.user!._id }),
      },
      { $set: { published: input.published }, $inc: { version: 1 } },
      { new: true },
    );
    if (!saved)
      throw new AppError(
        409,
        "MODULE_CONFLICT",
        "Reload the current module before publishing.",
      );
    res.json({ success: true, data: { module: moduleDTO(saved) } });
  });
  r.get("/manage/modules/:id/progress", staff, async (req, res) => {
    const m = await owned(req.params.id, req.user!);
    const scope = await staffScope(
      req.user!,
      !!req.app.locals.allowDemoAccounts,
    );
    const records = await LearningProgress.find({
      moduleId: m._id,
      studentId: { $in: scope.studentIds },
    })
      .populate<{
        studentId: { _id: unknown; name: string; department?: string };
      }>({ path: "studentId", select: "name department" })
      .limit(200);
    res.json({
      success: true,
      data: {
        progress: records
          .filter((p) => p.studentId)
          .map((p) => ({
            student: {
              id: p.studentId._id,
              name: p.studentId.name,
              department: p.studentId.department,
            },
            ...progressDTO(
              m,
              p as unknown as InstanceType<typeof LearningProgress>,
            ),
          })),
        scope:
          "Progress for authorized students in this module; latest 200 records.",
      },
    });
  });
  r.get("/modules", student, async (req, res) => {
    const q = z
      .object({
        subject: z.string().max(100).optional(),
        topic: z.string().max(100).optional(),
        completed: z.enum(["true", "false"]).optional(),
      })
      .strict()
      .parse(req.query);
    const { completed, ...filters } = q;
    const modules = await LearningModule.find({ published: true, ...filters })
      .sort({ title: 1 })
      .limit(100);
    const records = await LearningProgress.find({
      studentId: req.user!._id,
      moduleId: { $in: modules.map((m) => m._id) },
    });
    const data = modules
      .map((m) => ({
        ...moduleDTO(m),
        progress: progressDTO(
          m,
          records.find((p) => p.moduleId?.equals(m._id)) || null,
        ),
      }))
      .filter(
        (m) =>
          completed === undefined ||
          (m.progress.percent === 100) === (completed === "true"),
      );
    res.json({ success: true, data: { modules: data } });
  });
  const published = async (id: unknown) => {
    const m = await LearningModule.findOne({
      _id: objectIdSchema.parse(id),
      published: true,
    });
    if (!m) throw new AppError(404, "NOT_FOUND", "Published module not found.");
    return m;
  };
  r.get("/modules/:id/lessons/:lessonId/pdf", student, async (req, res) => {
    await sendLessonPdf(
      { _id: objectIdSchema.parse(req.params.id), published: true },
      objectIdSchema.parse(req.params.lessonId).toLowerCase(),
      res,
    );
  });
  r.get("/modules/:id", student, async (req, res) => {
    const m = await published(req.params.id);
    const p = await LearningProgress.findOne({
      studentId: req.user!._id,
      moduleId: m._id,
    });
    res.json({
      success: true,
      data: { module: moduleDTO(m), progress: progressDTO(m, p) },
    });
  });
  for (const action of ["visit", "completion"])
    r.post(
      `/modules/:id/lessons/:lessonId/${action}`,
      student,
      async (req, res) => {
        const m = await published(req.params.id),
          lessonId = objectIdSchema.parse(req.params.lessonId);
        if (!m.lessons.some((l) => l.id === lessonId))
          throw new AppError(404, "NOT_FOUND", "Published lesson not found.");
        const input =
          action === "visit"
            ? z.object({}).strict().parse(req.body)
            : z.object({ complete: z.boolean() }).strict().parse(req.body);
        const filter = {
          studentId: req.user!._id,
          moduleKey: `module:${m.id}`,
        };
        const previous =
          action === "completion"
            ? await LearningProgress.findOne(filter)
            : null;
        const previouslyComplete =
          previous &&
          progressDTO(m, previous).totalLessons > 0 &&
          progressDTO(m, previous).completedLessons ===
            progressDTO(m, previous).totalLessons;
        const update = {
          $set: {
            moduleId: m._id,
            title: m.title,
            totalLessons: m.lessons.length,
            lastLessonId: lessonId,
          },
          $setOnInsert: { completedLessons: 0 },
          ...(action === "completion"
            ? "complete" in input && input.complete
              ? { $addToSet: { completedLessonIds: lessonId } }
              : { $pull: { completedLessonIds: lessonId } }
            : {}),
        };
        let p;
        try {
          p = await LearningProgress.findOneAndUpdate(filter, update, {
            upsert: true,
            new: true,
            runValidators: true,
            setDefaultsOnInsert: true,
          });
        } catch (e) {
          if (typeof e === "object" && e && "code" in e && e.code === 11000)
            p = await LearningProgress.findOneAndUpdate(filter, update, {
              new: true,
              runValidators: true,
            });
          else throw e;
        }
        if (!p)
          throw new AppError(
            409,
            "PROGRESS_CONFLICT",
            "Please retry progress saving.",
          );
        const progress = progressDTO(m, p);
        if (action === "completion" && "complete" in input && input.complete)
          await recordActivity(
            req.user!.id as string,
            "lesson_completed",
            `Completed ${m.lessons.find((l) => l.id === lessonId)!.title}`,
            `lesson:${lessonId}`,
          );
        if (
          action === "completion" &&
          "complete" in input &&
          input.complete &&
          progress.totalLessons > 0 &&
          progress.completedLessons === progress.totalLessons
        ) {
          // Preserve the first real transition. Historical recognition must never become a new streak day.
          if (!previouslyComplete && !previous?.engagementRecognizedAt)
            await LearningProgress.updateOne(
              { _id: p._id, engagementCompletedAt: null },
              { $set: { engagementCompletedAt: p.updatedAt } },
            );
          else if (previouslyComplete && !previous?.engagementCompletedAt)
            await LearningProgress.updateOne(
              { _id: p._id, engagementRecognizedAt: null },
              { $set: { engagementRecognizedAt: new Date() } },
            );
        }
        res.json({ success: true, data: { progress } });
      },
    );
  return r;
}
