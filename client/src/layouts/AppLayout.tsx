import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Code2,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  ShieldCheck,
  Trophy,
  Users,
  Video,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { Brand } from "../components/Brand";
import { roleLabels, type Role } from "../types";
import { useAuth } from "../features/auth/AuthProvider";
import { useNavigationDrawer } from "../hooks/useNavigationDrawer";

export function AppLayout({
  role,
  children,
}: {
  role: Role;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { drawer, mobile } = useNavigationDrawer(open, () => setOpen(false));
  const navigate = useNavigate();
  const auth = useAuth();
  const location = useLocation();
  const destinations: Record<string, string> = {
    'Disha Meet': role === 'student' ? '/live-classes' : `/manage/${role}/live-classes`,
    Hackathons: "/workspace/hackathons",
    Leaderboard:
      role === "student" ? "/leaderboard" : `/manage/${role}/leaderboard`,
    Achievements: "/achievements",
    "Trainers & accounts": "/manage/admin/trainers",
    Assignments: `/manage/${role}/assignments`,
    "Reports & analytics": `/manage/${role}/reports`,
    "Questions & tests": `/manage/${role}/assessments`,
    "Student directory": `/manage/${role}/students`,
    "Batches & students": `/manage/${role}/batches`,
    "Company preparation": "/companies",
    "Learning modules": "/learning",
    "Learning content": `/learning/manage/${role}`,
    "Coding practice": "/coding",
    "Resume studio": "/resumes",
    "ATS analyzer": "/resume-analyzer",
    "Mock interviews": "/interviews",
    Assessments: "/assessments",
    "Performance analytics": "/analytics",
  };
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `workspace-link ${isActive ? "is-active" : ""}`;
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  async function logout() {
    setLoggingOut(true);
    setLogoutError("");
    try {
      await auth.logout();
      navigate("/login", { replace: true, state: { loggedOut: true } });
    } catch (err) {
      setLogoutError(
        err instanceof Error
          ? err.message
          : "Unable to sign out. Please try again.",
      );
    } finally {
      setLoggingOut(false);
    }
  }
  const student = [
    { title: "Learn & practise", links: [
      ["Learning modules", BookOpen], ["Coding practice", Code2],
      ["Assessments", FileText], ["Disha Meet", Video],
    ] },
    { title: "Career toolkit", links: [
      ["Mock interviews", MessageSquare], ["Resume studio", BriefcaseBusiness],
      ["ATS analyzer", FileText], ["Company preparation", Users], ["Hackathons", Trophy],
    ] },
    { title: "Track progress", links: [
      ["Performance analytics", BarChart3], ["Leaderboard", Trophy], ["Achievements", Trophy],
    ] },
  ] as const;
  const staff = [
    { title: "Manage training", links: [
      ["Batches & students", Users], ["Student directory", Users],
      ["Learning content", BookOpen], ["Questions & tests", FileText],
      ["Assignments", BriefcaseBusiness], ["Disha Meet", Video],
    ] },
    { title: "Track progress", links: [
      ["Reports & analytics", BarChart3], ["Leaderboard", Trophy],
      ...(role === "admin" ? [["Trainers & accounts", ShieldCheck] as const] : []),
    ] },
  ] as const;
  return (
    <div className="workspace-shell min-h-screen bg-canvas">
      {open && (
        <button
          className="fixed inset-0 z-30 bg-black/65 lg:hidden"
          aria-label="Close navigation"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        ref={drawer}
        id="workspace-navigation"
        inert={mobile && !open}
        role={mobile && open ? "dialog" : undefined}
        aria-modal={mobile && open ? true : undefined}
        aria-label="Workspace navigation"
        className={`workspace-sidebar fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-panel transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex min-h-20 shrink-0 items-center justify-between px-5">
          <Link to={`/dashboard/${role}`} aria-label="Disha360 home">
            <Brand />
          </Link>
          <button
            className="icon-button lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-role mx-4 mb-2 shrink-0">
          <span className="signal-kicker"><i />
            Your workspace
          </span>
          <p className="mt-1 truncate text-sm font-semibold text-ink">
            {roleLabels[role]}
          </p>
        </div>
        <nav aria-label="Main navigation" className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          <NavLink to={`/dashboard/${role}`} className={navClass} onClick={() => setOpen(false)}>
            <LayoutDashboard size={17} /> Overview
          </NavLink>
          {(role === "student" ? student : staff).map(({ title, links }) => <div key={title} className="workspace-nav-group">
            <p>{title}</p>
            {links.map(([label, Icon]) => <NavLink key={label} to={destinations[label]} className={navClass} onClick={() => setOpen(false)}>
              <Icon size={17} /> {label}
            </NavLink>)}
          </div>)}
        </nav>
        <div className="shrink-0 border-t border-line">
          {logoutError && (
            <p role="alert" className="px-5 pt-3 text-xs text-red-700">
              {logoutError}
            </p>
          )}
          <button
            onClick={() => void logout()}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 px-5 py-4 text-sm font-semibold text-slate-500 hover:bg-raised hover:text-ink"
          >
            <LogOut size={17} />
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>
      <div className="min-w-0 lg:pl-64" inert={mobile && open}>
        <header className="workspace-topbar flex min-h-20 items-center justify-between gap-3 border-b border-line px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="icon-button lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
              aria-expanded={open}
              aria-controls="workspace-navigation"
            >
              <Menu size={22} />
            </button>
            <span className="min-w-0 text-sm text-slate-500">
              <span className="hidden sm:inline">Workspace <span className="mx-2 text-slate-300">/</span></span>
              <span className="font-medium text-ink">
                {location.pathname === "/workspace/hackathons"
                  ? "Hackathons"
                  : (location.pathname.startsWith('/live-classes') || /^\/manage\/(admin|trainer)\/live-classes(?:\/|$)/.test(location.pathname))
                  ? 'Disha Meet'
                  : location.pathname.startsWith("/leaderboard")
                  ? "Leaderboard"
                  : location.pathname === "/achievements"
                    ? "Achievements"
                    : location.pathname.startsWith("/manage")
                      ? "Staff management"
                      : location.pathname.startsWith("/companies")
                        ? "Company preparation"
                        : location.pathname.startsWith("/learning")
                          ? "Learning modules"
                          : location.pathname.startsWith("/coding")
                            ? "Coding practice"
                            : location.pathname.startsWith("/resumes")
                              ? "Resume studio"
                              : location.pathname === "/resume-analyzer"
                                ? "ATS analyzer"
                                : location.pathname.startsWith("/interviews")
                                  ? "Mock interviews"
                                  : location.pathname.startsWith(
                                        "/assessments",
                                      ) ||
                                      location.pathname.startsWith("/attempts")
                                    ? "Assessments"
                                    : location.pathname === "/analytics"
                                      ? "Performance analytics"
                                      : "Overview"}
              </span>
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="max-w-24 text-right sm:max-w-44">
              <p className="truncate text-xs font-semibold text-ink">
                {auth.user?.name}
              </p>
              <p className="mt-1 truncate text-[10px] text-slate-500">
                {roleLabels[role]}
              </p>
            </div>
            <span className="hidden h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-brand sm:flex">
              {role === "student" ? "ST" : role === "trainer" ? "TF" : "AD"}
            </span>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-[1440px] p-4 sm:p-8 lg:p-9"
        >
          {children}
        </main>
        <footer className="flex flex-wrap justify-between gap-2 px-4 pb-6 text-xs text-slate-400 sm:px-8">
          <span>© {new Date().getFullYear()} Disha360</span>
          <span>Placement preparation, one step at a time.</span>
        </footer>
      </div>
    </div>
  );
}
