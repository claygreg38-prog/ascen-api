// Build identification stamp — written at commit time so we can verify
// the deployed container is running the expected source.
// SHA is updated by `git commit --amend` after the initial commit.
module.exports = {
  stamp: 'AUTHDIAG-2026-04-29-2326',
  parent_main_sha: 'e0dbdd4',
  branch: 'diag/auth-instrumentation',
  purpose: 'auth-login-diagnostic'
};
