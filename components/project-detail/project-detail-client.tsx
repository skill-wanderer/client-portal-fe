"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

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

export function ProjectDetailClient({
  project,
  tasks,
  messages,
  files,
}: ProjectDetailClientProps) {
  const router = useRouter();
  const [taskError, setTaskError] = useState<string | null>(null);
  const [messageBody, setMessageBody] = useState("");
  const [messageError, setMessageError] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isMessageSubmitting, setIsMessageSubmitting] = useState(false);
  const [isRefreshing, startRefreshTransition] = useTransition();

  async function handleCompleteTask(taskId: string) {
    setActiveTaskId(taskId);
    setTaskError(null);

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
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link
              href="/dashboard"
              className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Back to dashboard
            </Link>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {project.name}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {project.summary}
            </p>
          </div>
          <div className="flex flex-col gap-3 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="inline-flex w-fit rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
              {project.status.replaceAll("_", " ")}
            </span>
            <div>
              <span className="font-medium text-zinc-500 dark:text-zinc-500">Start date:</span>{" "}
              <span className="text-zinc-900 dark:text-zinc-100">{formatDate(project.startDate)}</span>
            </div>
            <div>
              <span className="font-medium text-zinc-500 dark:text-zinc-500">Target date:</span>{" "}
              <span className="text-zinc-900 dark:text-zinc-100">{formatDate(project.targetDate)}</span>
            </div>
            <div>
              <span className="font-medium text-zinc-500 dark:text-zinc-500">Last updated:</span>{" "}
              <span className="text-zinc-900 dark:text-zinc-100">{formatDate(project.lastUpdatedAt)}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-8">
          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  Tasks
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                  Project tasks
                </h2>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{tasks.length} item(s)</p>
            </div>

            {taskError ? (
              <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {taskError}
              </div>
            ) : null}

            <div className="mt-6 space-y-4">
              {tasks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-10 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                  No tasks are attached to this project.
                </div>
              ) : (
                tasks.map((task) => {
                  const isTaskDone = task.status === "done";
                  const isTaskBusy = activeTaskId === task.id && isRefreshing;

                  return (
                    <article
                      key={task.id}
                      className="rounded-2xl border border-zinc-100 p-5 dark:border-zinc-900"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                            {task.title}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                            {task.description}
                          </p>
                        </div>
                        <div className="flex flex-col items-start gap-3 lg:items-end">
                          <span className="inline-flex rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                            {task.status.replaceAll("_", " ")}
                          </span>
                          {isTaskDone ? (
                            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                              Completed {formatDateTime(task.completedAt)}
                            </span>
                          ) : (
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={Boolean(activeTaskId) || isRefreshing}
                              onClick={() => void handleCompleteTask(task.id)}
                            >
                              {isTaskBusy ? "Completing..." : "Complete Task"}
                            </Button>
                          )}
                        </div>
                      </div>

                      <dl className="mt-5 grid gap-3 text-sm text-zinc-500 dark:text-zinc-400 md:grid-cols-2">
                        <div>
                          <dt className="font-medium">Due date</dt>
                          <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{formatDate(task.dueDate)}</dd>
                        </div>
                        <div>
                          <dt className="font-medium">Assigned user</dt>
                          <dd className="mt-1 break-all text-zinc-900 dark:text-zinc-100">{task.assignedUserId}</dd>
                        </div>
                      </dl>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  Messages
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                  Project conversation
                </h2>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{messages.length} message(s)</p>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSendMessage}>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Send an update
                <textarea
                  className="mt-2 min-h-28 w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-100"
                  value={messageBody}
                  onChange={(event) => setMessageBody(event.target.value)}
                  placeholder="Write a project update that will be posted through the live message API."
                />
              </label>

              {messageError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {messageError}
                </div>
              ) : null}

              <div className="flex justify-end">
                <Button type="submit" disabled={isMessageSubmitting || isRefreshing}>
                  {isMessageSubmitting ? "Sending..." : "Send Message"}
                </Button>
              </div>
            </form>

            <div className="mt-8 space-y-4">
              {messages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-10 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                  No messages have been sent for this project yet.
                </div>
              ) : (
                messages.map((message) => (
                  <article
                    key={message.id}
                    className="rounded-2xl border border-zinc-100 p-5 dark:border-zinc-900"
                  >
                    <div className="flex flex-col gap-3 text-sm text-zinc-500 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
                      <p>
                        <span className="font-medium">Author:</span> {message.authorUserId}
                      </p>
                      <p>{formatDateTime(message.createdAt)}</p>
                    </div>
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                      {message.body}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              Files
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              Project files
            </h2>
          </div>

          <div className="mt-6 space-y-4">
            {files.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-10 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                No files are available for this project yet.
              </div>
            ) : (
              files.map((file) => (
                <article
                  key={file.id}
                  className="rounded-2xl border border-zinc-100 p-4 dark:border-zinc-900"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {file.fileName}
                      </h3>
                      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                        {file.mimeType}
                      </p>
                    </div>
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                      {formatBytes(file.sizeBytes)}
                    </span>
                  </div>

                  <dl className="mt-4 grid gap-3 text-xs text-zinc-500 dark:text-zinc-400">
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