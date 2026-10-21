// Shown instead of a Books page when its database tables aren't there yet (a migration hasn't been run).
export default function MigrationNotice({ missing }) {
  return <section className="books-empty migration-notice" role="alert">
    <p className="eyebrow">DATABASE UPDATE NEEDED</p>
    <p>This part of Books needs {missing.length === 1 ? "a database update" : `${missing.length} database updates`} before it can open.</p>
    <ol className="admin-note">
      {missing.map((m) => <li key={m.file}>Supabase → <strong>SQL Editor</strong> → <strong>New query</strong> → paste all of <code>supabase/migrations/{m.file}</code> → <strong>Run</strong> (docs/SETUP.md {m.setup}).</li>)}
    </ol>
    <p className="admin-note">Run them in number order, then reload this page. Nothing else needs to change.</p>
  </section>;
}
