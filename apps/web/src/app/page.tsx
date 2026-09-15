import Link from 'next/link';

const goals = [
  {
    title: 'Preserve church history',
    description:
      'Sermons, records, testimonies, and milestones captured in a durable digital archive that outlives staff turnover.',
  },
  {
    title: 'Strengthen church community',
    description:
      'Prayer, counseling, ministries, and volunteering connected in one place so people are known, not just counted.',
  },
  {
    title: 'Simplify ministry operations',
    description:
      'Membership, attendance, events, giving, and accounting unified so leaders spend time on people, not paperwork.',
  },
  {
    title: 'Organize institutional knowledge',
    description:
      'Every policy, decision, and document structured and searchable, so wisdom is never lost between generations.',
  },
  {
    title: 'Enable AI-powered discovery',
    description:
      'Ask questions in plain language and get grounded answers cited back to the original records.',
  },
];

const modules = [
  'Multi-Tenant SaaS',
  'Authentication',
  'Church Workspace',
  'Membership',
  'Attendance',
  'Events',
  'Ministries',
  'Volunteer Management',
  'Giving',
  'Accounting',
  'Prayer',
  'Counseling',
  'Sermons',
  'AI Memory',
  'Digital Archives',
  'Website Builder',
  'Notifications',
  'Reports',
  'Analytics',
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-12">
      <header className="flex items-center justify-between">
        <span className="text-lg font-semibold tracking-tight">
          Zion<span className="text-zion-400">8</span>
        </span>
        <nav className="flex items-center gap-3 text-sm">
          <Link
            href="/sign-in"
            className="rounded-lg px-4 py-2 text-slate-300 transition hover:text-white"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="bg-zion-600 hover:bg-zion-500 rounded-lg px-4 py-2 font-medium text-white transition"
          >
            Create workspace
          </Link>
        </nav>
      </header>

      <section className="mt-24 max-w-3xl">
        <p className="text-zion-300 text-sm font-medium uppercase tracking-[0.2em]">
          Digital Memory &amp; Operating System
        </p>
        <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
          The operating system for the church that remembers.
        </h1>
        <p className="mt-6 text-lg text-slate-300">
          Zion8 is not another church management system. It preserves institutional knowledge while
          running the daily operations of ministry — so the story of your church is never lost.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/sign-up"
            className="bg-zion-600 hover:bg-zion-500 rounded-lg px-6 py-3 font-medium text-white transition"
          >
            Start your church workspace
          </Link>
          <Link
            href="/sign-in"
            className="rounded-lg border border-white/15 px-6 py-3 font-medium text-slate-200 transition hover:border-white/30"
          >
            Sign in to Zion8
          </Link>
        </div>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        {['Preserve the Past', 'Empower the Present', 'Inspire the Future'].map((vision) => (
          <div
            key={vision}
            className="rounded-2xl border border-white/10 bg-white/5 px-6 py-8 text-center"
          >
            <span className="text-zion-200 text-sm font-medium tracking-wide">{vision}</span>
          </div>
        ))}
      </section>

      <section className="mt-24">
        <h2 className="text-2xl font-semibold tracking-tight">Every feature serves one goal</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal, index) => (
            <article key={goal.title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <span className="text-zion-300 text-xs font-semibold">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-3 text-lg font-medium">{goal.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{goal.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-24">
        <h2 className="text-2xl font-semibold tracking-tight">Built as a platform</h2>
        <p className="mt-3 max-w-2xl text-slate-300">
          Multi-tenant by design, API-first, event-driven, and secure from the first commit.
        </p>
        <ul className="mt-8 flex flex-wrap gap-2">
          {modules.map((module) => (
            <li
              key={module}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-slate-200"
            >
              {module}
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-auto pt-24 text-sm text-slate-500">
        <p>Zion8 — Preserve the Past. Empower the Present. Inspire the Future.</p>
      </footer>
    </main>
  );
}
