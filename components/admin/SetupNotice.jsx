export default function SetupNotice() {
  return <div className="admin-page admin-narrow">
    <p className="eyebrow">ADMIN SETUP</p>
    <h1>Connect Supabase<br /><em>to get started.</em></h1>
    <p>The admin panel needs a Supabase project. Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code>.env.local</code>, restart the dev server, and follow <code>docs/SETUP.md</code>.</p>
  </div>;
}
