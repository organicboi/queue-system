# Fixing a Repo's Git Account (No Global Switching)

If you work with **multiple GitHub accounts** on the same machine, you've hit this: you push to Repo A as Account 1, then push to Repo B and it fails with a confusing `remote: Repository not found` — even though the repo clearly exists. That happens because push authentication is using the wrong account, and GitHub returns "not found" instead of a permissions error so it doesn't leak whether a private repo exists.

This doc shows how to **pin a single repo to a specific GitHub account permanently**, so you never have to run `gh auth switch` or edit global git config again for that project — regardless of which account is globally active.

## Why this happens

- `git config user.name` / `user.email` only control **commit authorship** (who gets credited in the log). They do **not** control **push authentication**.
- Push authentication is controlled by the **credential helper**, which by default is set **globally** (`git config --global credential.helper`). If you use `gh` (GitHub CLI) as your credential helper, it authenticates as whichever account is currently `gh`'s "active account" — which is global, shared across every repo on the machine.
- So even if a repo's local config correctly says `user.name = correct-account`, the actual push can still authenticate as the wrong account.

## The fix: two local (not global) overrides per repo

Run these **inside the target repo** (not with `--global`). Local config lives in that repo's `.git/config` and only affects that repo.

### 1. Pin commit authorship

```bash
git config --local user.name "<github-username>"
git config --local user.email "<email-for-that-account>"
```

### 2. Pin push authentication

This is the part people usually miss. If you use GitHub CLI (`gh`) and have **multiple accounts already logged in** (check with `gh auth status` — logging in again is not required if the account is already listed), you can pin the credential helper to always resolve to one specific account's token, without changing which account is globally "active":

```bash
git config --local credential.https://github.com.helper ""
git config --local --add credential.https://github.com.helper '!f() { echo username=<github-username>; echo password=$(gh auth token -h github.com -u <github-username>); }; f'
```

- The first line clears the *inherited* global helper list for this repo only (otherwise both the global and local helpers run, and the global one may win).
- The second line adds a new helper, scoped to this repo, that always asks `gh` for the token belonging to `<github-username>` specifically — via `gh auth token -u <github-username>` — instead of whatever account is globally active.

### 3. Verify

```bash
git config --local -l | grep -E "user\.|credential"
```

You should see your local overrides. Then just `git push` normally — no `gh auth switch`, no editing `~/.gitconfig`, nothing global touched.

## Prerequisites

- The target GitHub account must already be authenticated with `gh`: check via `gh auth status`. If it's not listed, run `gh auth login -h github.com` once to add it (this does **not** need to be the active account — `gh` can hold several logged-in accounts simultaneously).
- `gh auth token -u <username>` requires that specific account to be present in `gh`'s keyring, not necessarily active.

## If you don't use `gh` as your credential helper

If you're on plain HTTPS with a Personal Access Token (PAT), skip the `gh`-based helper and instead use a per-repo credential source, e.g.:

```bash
git config --local credential.https://github.com.helper ""
git config --local --add credential.https://github.com.helper '!f() { echo username=<github-username>; echo password=<PAT>; }; f'
```

(Storing a raw PAT in repo-local `.git/config` is fine since that file is never committed — it's outside the working tree that gets tracked by git itself.)

Alternatively, use **SSH with a host alias** — cleaner for long-term multi-account setups:

1. Generate a separate SSH key per account (if you don't have one): `ssh-keygen -t ed25519 -C "<email>" -f ~/.ssh/id_ed25519_<account>`
2. Add it to the corresponding GitHub account's SSH keys settings.
3. Add a host alias in `~/.ssh/config`:
   ```
   Host github-<account>
       HostName github.com
       User git
       IdentityFile ~/.ssh/id_ed25519_<account>
   ```
4. Set this repo's remote to use the alias instead of `github.com`:
   ```bash
   git remote set-url origin git@github-<account>:<owner>/<repo>.git
   ```

This works per-repo automatically because the remote URL itself encodes which key to use — no credential helper juggling needed.

## Summary

| What | Scope | Command |
|---|---|---|
| Commit author | Local only | `git config --local user.name/user.email` |
| Push auth (gh CLI) | Local only | `git config --local credential.https://github.com.helper` override using `gh auth token -u <account>` |
| Push auth (SSH) | Per-remote | Host alias in `~/.ssh/config` + `git remote set-url` |

Never touch `--global` config or run `gh auth switch` to solve this — that fixes one repo and breaks whichever repo was relying on the previously-active account.
