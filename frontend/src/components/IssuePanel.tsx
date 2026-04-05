type Issue = {
  title: string;
  detail: string;
};

type IssuePanelProps = {
  issues: Issue[];
};

export default function IssuePanel({ issues }: IssuePanelProps) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <h3 className="text-lg font-medium">Current issues</h3>
      {issues.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-400">No active issues detected from the latest probes.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {issues.map((issue, index) => (
            <div key={`${issue.title}-${index}`} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <p className="font-medium">{issue.title}</p>
              <p className="mt-1 text-sm text-zinc-400">{issue.detail}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
