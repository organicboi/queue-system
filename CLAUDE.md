@AGENTS.md

# Project Account Configuration

## GitHub
- **Account:** organicboi
- **Email:** organicboi@users.noreply.github.com
- **Repo:** https://github.com/organicboi/queue-system
- **Remote:** `git@github-organicboi:organicboi/queue-system.git` (SSH host alias — see
  [docs/git-multi-account-setup.md](docs/git-multi-account-setup.md))

## Vercel
- **Account:** supersonicamg
- **Email:** iamnotgonnagetoutofit@gmail.com
- **Plan:** Hobby (private repo — no collaboration, single author only)
- **Deployment triggers from:** pushes to `main` on the GitHub repo above

## Git Config (local — must match above)
```
git config user.name "organicboi"
git config user.email "organicboi@users.noreply.github.com"
```

## Known Gotchas
- **Never add `Co-Authored-By:` trailers to commits.** Vercel Hobby plan blocks deployments if it sees an author/co-author not on the project.
- **Commit author must match the Vercel account.** If local git config drifts, Vercel will block deploys with "commit author did not have contributing access." Fix with `git config user.name/email` + `git commit --amend --reset-author` + force push.
