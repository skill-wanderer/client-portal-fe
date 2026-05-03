"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

interface ProjectDetailClientProps {
  project: {
    id: string;
    name: string;
    summary: string;
    status: string;
    startDate: string | null;
    targetDate: string | null;
    lastUpdatedAt: string;
  };
  tasks: Array<{
    id: string;
    assignedUserId: string;
    title: string;
    description: string;
    status: string;
    dueDate: string | null;
    completedAt: string | null;
  }>;
  messages: Array<{
    id: string;
    authorUserId: string;
    body: string;
    createdAt: string;
    readAt: string | null;
  }>;
  files: Array<{
    id: string;
    uploadedByUserId: string;
    fileName: string;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    category: string;
    createdAt: string;
  }>;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAuthorId(value: string) {
  if (value.length <= 16) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function FileIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 3.5H7.5A2.5 2.5 0 0 0 5 6v12a2.5 2.5 0 0 0 2.5 2.5h9A2.5 2.5 0 0 0 19 18V8.5L14 3.5Z" />
      <path d="M14 3.5V8h4.5" />
      <path d="M8.5 12.5h7" />
      <path d="M8.5 16h5" />
    </svg>
  );
}

function LoadingIndicator({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
      />
      {label}
    </span>
  );
}

export function ProjectDetailClient({
  project,
  tasks,
  messages,
  files,
}: ProjectDetailClientProps) {
  const router = useRouter();
  const [taskError, setTaskError] = useState<string | null>(null);
  const [taskFeedback, setTaskFeedback] = useState<string | null>(null);
  const [messageBody, setMessageBody] = useState("");
  const [messageError, setMessageError] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isMessageSubmitting, setIsMessageSubmitting] = useState(false);
  const [isRefreshing, startRefreshTransition] = useTransition();

  async function handleCompleteTask(taskId: string) {
    setActiveTaskId(taskId);
    setTaskError(null);
    setTaskFeedback(null);

    const response = await fetch(`/api/tasks/${taskId}/complete`, {
      method: "POST",
    });

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      setActiveTaskId(null);

      if (response.status === 404) {
        setTaskError("This task is no longer available for your account.");
        return;
      }

      if (response.status === 403) {
        setTaskError("Your account is not provisioned for this project.");
        return;
      }

      setTaskError("We could not complete the task. Try again.");
      return;
    }

    const completedTask = tasks.find((task) => task.id === taskId);

    setTaskFeedback(
      completedTask
        ? `Marked \"${completedTask.title}\" complete. Syncing the latest project data.`
        : "Marked the task complete. Syncing the latest project data."
    );
    setActiveTaskId(null);

    startRefreshTransition(() => {
      router.refresh();
    });
  }

  async function handleSendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessageError(null);

    const trimmedBody = messageBody.trim();

    if (!trimmedBody) {
      setMessageError("Enter a message before sending.");
      return;
    }

    setIsMessageSubmitting(true);

    const response = await fetch(`/api/projects/${project.id}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ body: trimmedBody }),
    });

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      setIsMessageSubmitting(false);

      if (response.status === 403) {
        setMessageError("Your account is not provisioned for this project.");
        return;
      }

      if (response.status === 404) {
        setMessageError("This project is no longer available for your account.");
        return;
      }

      if (response.status === 400) {
        setMessageError("Enter a valid message before sending.");
        return;
      }

      setMessageError("We could not send your message. Try again.");
      return;
    }

    setMessageBody("");
    setIsMessageSubmitting(false);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="ui-surface overflow-hidden rounded-4xl border border-zinc-200/80 bg-white shadow-sm shadow-zinc-950/3 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200/80 bg-zinc-50/70 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/60 sm:px-6">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <Link
              href="/dashboard"
              className="font-medium transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Dashboard
            </Link>
            <span aria-hidden="true">/</span>
            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
              Current project
            </span>
          </nav>
        </div>
        <div className="grid gap-6 px-5 py-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.85fr)] lg:items-start sm:px-6 sm:py-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
              Project detail
            </p>
            <h1 className="mt-3 wrap-break-word text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-4xl">
              {project.name}
            </h1>
            <p className="ui-line-clamp-4 mt-4 max-w-3xl wrap-break-word text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {project.summary}
            </p>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div className="rounded-[1.35rem] border border-zinc-200/80 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/80">
              <dt className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                Status
              </dt>
              <dd className="mt-2">
                <span className="inline-flex w-fit rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">
                  {project.status.replaceAll("_", " ")}
                </span>
              </dd>
            </div>
            <div className="rounded-[1.35rem] border border-zinc-200/80 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/80">
              <dt className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                Start date
              </dt>
              <dd className="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-100">
                {formatDate(project.startDate)}
              </dd>
            </div>
            <div className="rounded-[1.35rem] border border-zinc-200/80 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/80">
              <dt className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                Target date
              </dt>
              <dd className="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-100">
                {formatDate(project.targetDate)}
              </dd>
            </div>
            <div className="rounded-[1.35rem] border border-zinc-200/80 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/80">
              <dt className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                Last updated
              </dt>
              <dd className="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-100">
                {formatDate(project.lastUpdatedAt)}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-8">
          <section className="ui-surface overflow-hidden rounded-[1.75rem] border border-zinc-200/80 bg-white p-5 shadow-sm shadow-zinc-950/3 sm:p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                  Tasks
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                  Project tasks
                </h2>
              </div>
              <p className="shrink-0 text-sm text-zinc-500 dark:text-zinc-400">{tasks.length} item(s)</p>
            </div>

            {taskError ? (
              <div
                role="alert"
                className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
              >
                {taskError}
              </div>
            ) : null}

            {taskFeedback ? (
              <div
                aria-live="polite"
                className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              >
                {taskFeedback}
              </div>
            ) : null}

            <div className="mt-6 space-y-4">
              {tasks.length === 0 ? (
                <EmptyState
                  eyebrow="Tasks"
                  title="No project tasks yet"
                  description="Assigned action items for this project will appear here as soon as they are created."
                />
              ) : (
                tasks.map((task) => {
                  const isTaskDone = task.status === "done";
                  const isTaskBusy = activeTaskId === task.id;

                  return (
                    <article
                      key={task.id}
                      className="overflow-hidden rounded-3xl border border-zinc-200/70 bg-zinc-50/70 p-5 transition-transform duration-200 hover:-translate-y-0.5 dark:border-zinc-800 dark:bg-zinc-900/60"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <h3 className="wrap-break-word text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                            {task.title}
                          </h3>
                          <p className="ui-line-clamp-4 mt-2 wrap-break-word text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                            {task.description}
                          </p>
                        </div>
                        <div className="flex flex-col items-start gap-3 lg:items-end">
                          <div className="flex flex-wrap gap-2 lg:justify-end">
                            <span className="inline-flex rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">
                              {task.status.replaceAll("_", " ")}
                            </span>
                            <span className="inline-flex rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
                              Due {formatDate(task.dueDate)}
                            </span>
                          </div>
                          {isTaskDone ? (
                            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                              Completed {formatDateTime(task.completedAt)}
                            </span>
                          ) : (
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={Boolean(activeTaskId) || isRefreshing}
                              aria-busy={isTaskBusy}
                              className="min-w-40"
                              onClick={() => void handleCompleteTask(task.id)}
                            >
                              {isTaskBusy ? (
                                <LoadingIndicator label={isRefreshing ? "Syncing..." : "Completing..."} />
                              ) : (
                                "Complete task"
                              )}
                            </Button>
                          )}
                        </div>
                      </div>

                      <dl className="mt-5 grid gap-3 text-sm text-zinc-500 dark:text-zinc-400 sm:grid-cols-2">
                        <div>
                          <dt className="font-medium">Due date</dt>
                          <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
                            {formatDate(task.dueDate)}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="font-medium">Assigned user</dt>
                          <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
                            <span className="block max-w-full truncate" title={task.assignedUserId}>
                              {formatAuthorId(task.assignedUserId)}
                            </span>
                          </dd>
                        </div>
                      </dl>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <section className="ui-surface overflow-hidden rounded-[1.75rem] border border-zinc-200/80 bg-white p-5 shadow-sm shadow-zinc-950/3 sm:p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                  Messages
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                  Project conversation
                </h2>
              </div>
              <p className="shrink-0 text-sm text-zinc-500 dark:text-zinc-400">{messages.length} message(s)</p>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSendMessage}>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Send an update
                <textarea
                  className="mt-2 min-h-28 w-full max-w-full resize-y rounded-2xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-100"
                  value={messageBody}
                  onChange={(event) => setMessageBody(event.target.value)}
                  placeholder="Write a project update that will be posted through the live message API."
                />
              </label>

              {messageError ? (
                <div
                  role="alert"
                  className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
                >
                  {messageError}
                </div>
              ) : null}

              <div className="flex justify-stretch sm:justify-end">
                <Button
                  type="submit"
                  disabled={isMessageSubmitting || isRefreshing}
                  aria-busy={isMessageSubmitting || isRefreshing}
                  className="w-full sm:w-auto sm:min-w-40"
                >
                  {isMessageSubmitting || isRefreshing ? (
                    <LoadingIndicator label={isMessageSubmitting ? "Sending..." : "Refreshing..."} />
                  ) : (
                    "Send message"
                  )}
                </Button>
              </div>
            </form>

            <div className="mt-8 space-y-4">
              {messages.length === 0 ? (
                <EmptyState
                  eyebrow="Messages"
                  title="No messages yet"
                  description="Project updates sent through the live conversation feed will appear here in order."
                />
              ) : (
                messages.map((message, index) => {
                  const startsNewGroup =
                    index === 0 ||
                    messages[index - 1]?.authorUserId !== message.authorUserId;

                  return (
                    <div
                      key={message.id}
                      className={startsNewGroup ? "" : "pl-6 sm:pl-10"}
                    >
                      {startsNewGroup ? (
                        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100" title={message.authorUserId}>
                            {formatAuthorId(message.authorUserId)}
                          </p>
                          <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                            {formatDateTime(message.createdAt)}
                          </p>
                        </div>
                      ) : (
                        <p className="mb-2 pl-4 text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                          {formatDateTime(message.createdAt)}
                        </p>
                      )}
                      <article className="ui-surface overflow-hidden rounded-3xl border border-zinc-200/70 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
                        <p className="whitespace-pre-wrap wrap-break-word text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                          {message.body}
                        </p>
                      </article>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        <section className="ui-surface overflow-hidden rounded-[1.75rem] border border-zinc-200/80 bg-white p-5 shadow-sm shadow-zinc-950/3 sm:p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                Files
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                Project files
              </h2>
            </div>
            <p className="shrink-0 text-sm text-zinc-500 dark:text-zinc-400">{files.length} file(s)</p>
          </div>

          <div className="mt-6 space-y-4">
            {files.length === 0 ? (
              <EmptyState
                eyebrow="Files"
                title="No project files yet"
                description="Shared files for this project will appear here once they are uploaded through the live portal workflow."
              />
            ) : (
              files.map((file) => (
                <article
                  key={file.id}
                  className="overflow-hidden rounded-3xl border border-zinc-200/70 bg-zinc-50/70 p-4 transition-transform duration-200 hover:-translate-y-0.5 dark:border-zinc-800 dark:bg-zinc-900/60"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">
                        <FileIcon />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100" title={file.fileName}>
                          {file.fileName}
                        </h3>
                        <p className="mt-2 truncate text-sm text-zinc-500 dark:text-zinc-400" title={file.mimeType}>
                          {file.mimeType}
                        </p>
                      </div>
                    </div>
                    <span className="self-start rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                      {formatBytes(file.sizeBytes)}
                    </span>
                  </div>

                  <dl className="mt-4 grid gap-3 text-xs text-zinc-500 dark:text-zinc-400 sm:grid-cols-2">
                    <div>
                      <dt className="font-medium">Category</dt>
                      <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
                        {file.category.replaceAll("_", " ")}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium">Uploaded</dt>
                      <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
                        {formatDateTime(file.createdAt)}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}