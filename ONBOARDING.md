# Getting Started — bp-fanworks-app (Intern Onboarding)

Welcome! Read this top to bottom before you touch any code. It assumes you know **nothing** about our setup, so every step is spelled out. If something doesn't work, stop and ask — don't guess.

---

## 1. What This Project Is

- **Repository:** `git@github.com:favourogundare/bp-fanworks-app.git` — you've been added as collaborators.
- **Live site:** https://blackpantherfanworks.com — **the site is live**. Go there and create a normal account; you'll need one for testing.
- **Tech:** React + TypeScript (Vite) → Supabase (database/auth) → deployed on Vercel.
- **Status:** The site is **under active development and does not have full functionality yet.** This is expected. I'll hand you a **milestones document** later telling you which features to build next. Until then, focus only on getting set up.

---

## 2. The Three Branches (read this twice)

| Branch | What it is | Can you touch it? |
|--------|------------|-------------------|
| **`working`** | This is **production** — it is the live deployment. (We use `working`, **not** `main`.) | ❌ **Never** commit or open a PR into `working`. |
| **`develop`** | Integration branch. Tested features land here. | ✅ You open PRs **into** `develop` only. |
| **`feature/...`** | Your personal work branches. | ✅ Always branch these **from `develop`**. |

**The rules:**
- Always create a feature branch from `develop`. Naming pattern: **`feature/whatever-the-change`** (e.g. `feature/add-dark-mode`).
- You **only ever open pull requests into `develop`**, never into `working`.
- We test locally first. **If Claude Code cannot confirm the change works, it does not get deployed.**

---

## 3. Tools You Must Install

Install all of these first.

| Tool | What it's for | Where to get it |
|------|---------------|-----------------|
| **Git** (includes **Git Bash**) | Version control + a Unix-style terminal on Windows | https://git-scm.com/ |
| **Node.js 20 LTS** | Runs the site locally | https://nodejs.org/ (pick the **LTS** build) |
| **Claude Code for Desktop** | The **only** way you make code changes | https://claude.ai/code/family |
| **GitHub Desktop** *(optional)* | Point-and-click way to clone/branch/commit/push | https://desktop.github.com/ |
| **Docker Desktop** | Container runtime (keep it installed; must be running if you ever run a local database) | https://www.docker.com/products/docker-desktop/ |

> You can do **everything** either with **Git Bash commands** or with **GitHub Desktop**. Both paths are shown below — pick whichever you're comfortable with.

---

## 4. SSH Keys — Authorization AND Signing

GitHub needs to know two things about you:
1. **Authorization (auth):** that you're allowed to push code.
2. **Signing:** that a commit really came from you (this is what gives you the green **"Verified"** badge).

We do **both with SSH** — **no GPG.** You will make **two keys**: one auth key and one signing key. Below, the **auth key goes in the default location** and the **signing key goes in a custom (non-default) location**, so you see how to do both.

### 4.1 — Make sure you have a `.ssh` folder in your home directory

Your keys live in a folder called `.ssh` inside your user (home) folder:

- **Windows:** `C:\Users\YourName\.ssh`  *(backslashes on Windows)*
- **Mac/Linux:** `/Users/YourName/.ssh` or `/home/YourName/.ssh`

Open **Git Bash** and check if it exists:

```bash
ls ~/.ssh
```

If you get **"No such file or directory"**, create it:

```bash
mkdir ~/.ssh
```

### 4.2 — Generate your AUTH key (default location)

```bash
ssh-keygen -t ed25519 -C "your-email@example.com"
```

- When it asks **"Enter file in which to save the key"**, just press **Enter** to accept the default → `~/.ssh/id_ed25519`.
- When it asks for a passphrase, you can press Enter for none (or set one — your choice).

This creates two files:
- `id_ed25519` → **private key** (never share this)
- `id_ed25519.pub` → **public key** (this is what you give GitHub)

### 4.3 — Generate your SIGNING key (non-default location)

This time we give it a **custom file name** with the `-f` flag, to show how a non-default location works:

```bash
ssh-keygen -t ed25519 -C "your-email@example.com" -f ~/.ssh/id_ed25519_signing
```

This creates:
- `id_ed25519_signing` → private signing key
- `id_ed25519_signing.pub` → public signing key

> You now have **two key pairs** in `~/.ssh`: one for auth (default name), one for signing (custom name).

### 4.4 — Copy a public key's contents

You'll need to paste each `.pub` file into GitHub. Two ways to read it:

**Way 1 — `cat` in the terminal:**
```bash
cat ~/.ssh/id_ed25519.pub          # auth key
cat ~/.ssh/id_ed25519_signing.pub  # signing key
```
Select and copy the whole line (starts with `ssh-ed25519 ...`).

**Way 2 — open the file in a text editor:**
Open your `.ssh` folder, right-click the **`.pub`** file → **Open with → Notepad**, and copy everything.

> ⚠️ Only ever copy the **`.pub`** (public) file. Never open or share the file **without** `.pub` — that's your private key.

### 4.5 — Add BOTH keys to GitHub on the web

**A key only works after you add it to your GitHub account online.** Go to:

👉 **https://github.com/settings/keys**

**Add the auth key:**
1. Click **New SSH key**.
2. Title: `bp-fanworks auth`
3. Key type: **Authentication Key**
4. Paste the contents of **`id_ed25519.pub`** → **Add SSH key**.

**Add the signing key:**
1. Click **New SSH key** again.
2. Title: `bp-fanworks signing`
3. Key type: **Signing Key**
4. Paste the contents of **`id_ed25519_signing.pub`** → **Add SSH key**.

### 4.6 — Tell Git to sign commits with SSH

Run these in Git Bash (this sets up SSH signing, **not** GPG):

```bash
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519_signing.pub
git config --global commit.gpgsign true
git config --global user.name  "Your Name"
git config --global user.email "your-email@example.com"
```

### 4.7 — Tell SSH which key to use for the connection

Because the signing key has a non-default name, create/edit the file `~/.ssh/config` so SSH knows which key to authenticate with:

```
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519
```

Quick way to create that file:
```bash
printf "Host github.com\n  HostName github.com\n  User git\n  IdentityFile ~/.ssh/id_ed25519\n" >> ~/.ssh/config
```

Test that auth works:
```bash
ssh -T git@github.com
```
You should see: *"Hi <your-username>! You've successfully authenticated..."*

### 4.8 — "Why can't I commit / push locally?!"

If pushing is rejected or commits show as **Unverified**, it's almost always one of these:
1. Your **auth key** isn't added to GitHub (or wasn't added as **Authentication Key**) → redo **4.5**.
2. **SSH commit signing isn't enabled** → re-run the commands in **4.6** (especially `gpg.format ssh` and `commit.gpgsign true`).
3. Your **signing key** wasn't added to GitHub as a **Signing Key** → redo **4.5**.

Check your last commit was signed correctly:
```bash
git log --show-signature -1
```
You want to see **"Good signature"**.

---

## 5. Clone the Repo and Run It Locally

### Option A — Git Bash (command line)

```bash
# Clone (SSH URL — uses the keys you just set up)
git clone git@github.com:favourogundare/bp-fanworks-app.git
cd bp-fanworks-app

# Install dependencies
npm install

# Create your environment file from the template
cp .env.example .env
```

### Option B — GitHub Desktop

1. **File → Clone repository → URL** tab.
2. Paste: `git@github.com:favourogundare/bp-fanworks-app.git`
3. Choose a folder → **Clone**.
4. Then **Repository → Open in Git Bash** and run `npm install` and `cp .env.example .env` from there.

### Fill in your `.env`

Open the new `.env` file. The Supabase **URL** is already filled in. You only need to add the **anon key**:

```
VITE_SUPABASE_URL=https://hvafigyajyujqwpvdfou.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
```

Get the anon key: you've been added to our **Supabase** team as a **developer**. Log in at https://supabase.com → open the **bp-fanworks-app** project → **Project Settings → API** → copy the **anon / public** key → paste it as `VITE_SUPABASE_ANON_KEY`.

### Start the site

```bash
npm run dev
```

Open the URL it prints — it will be **http://localhost:5173**.

---

## 6. How You Make Changes: Claude Code for Desktop

**You must use Claude Code for Desktop for all code changes.** This is the safe way to work on this codebase. Don't hand-edit files outside of it.

### 6.1 — Set it up

1. Download and install Claude Code for Desktop from **https://claude.ai/code/family**.
2. Open it → **Open Folder** → select the **`bp-fanworks-app`** folder that you cloned in Step 5 (e.g. wherever GitHub Desktop or `git clone` put it on your machine).
3. Claude loads the repo and you can start a **session** (a conversation about the code).

### 6.2 — Session rules (important)

- **One task = one fresh session.** Start a new session for each piece of work.
- **Don't let a session run too long.** After a lot of back-and-forth, Claude starts to **lose context** and forget earlier instructions. When you notice that, end the session and start a new one. Short, focused sessions = safe changes.
- Only commit when Claude tells you to, and let Claude drive the changes.

---

## 7. The Workflow: Branch → Build → Test → PR into develop

### Step 1 — Start from the latest `develop` and make a feature branch

**Git Bash:**
```bash
git checkout develop
git pull origin develop
git checkout -b feature/short-description
```

**GitHub Desktop:**
1. Switch **Current Branch** to `develop` → **Fetch origin** → **Pull**.
2. **Current Branch → New Branch** → name it `feature/short-description`, base it on **`develop`** → **Create**.

### Step 2 — Do the work in Claude Code, then test locally
Run `npm run dev` and confirm your change actually works in the browser. **If Claude Code can't confirm it works, it does not get merged or deployed.**

### Step 3 — Commit and push

**Git Bash:**
```bash
git add .
git commit -m "Short description of the change"
git push -u origin feature/short-description
```

**GitHub Desktop:**
Write a summary → **Commit to feature/...** → **Publish branch** (or **Push origin**).

### Step 4 — Open the Pull Request
On GitHub, open a PR **into `develop`**. ✅ Target = `develop`. ❌ **Never** target `working`.

---

## 8. Running Migrations (database changes)

Sometimes Claude will tell you a change needs a **database migration** and give you a block of **SQL**. When that happens:

1. Log in to **Supabase** → open the **bp-fanworks-app** project.
2. Open the **SQL Editor**.
3. Paste in **exactly** the SQL Claude gave you.
4. Run it.

**Rules:**
- Run the migration **exactly how Claude instructs** — don't edit, reorder, or "improve" the SQL.
- Run migrations in the **Supabase SQL Editor** (in the web dashboard). Not via local commands.
- If you're unsure whether to run it, **ask first.**

---

## 9. Your Access

- **GitHub:** collaborator on the repo.
- **Vercel:** added as a **member** (you can view deployments — don't change production settings).
- **Supabase:** added as a **developer** (use the dashboard for the anon key and for running SQL).
- **Live site:** create a normal account at https://blackpantherfanworks.com for testing.

---

## 10. Before-Commit Checklist

- [ ] I'm on a `feature/...` branch (branched from `develop`) — **not** `develop` or `working`.
- [ ] I tested my change locally with `npm run dev` and it works.
- [ ] If a migration was needed, I ran it in the **Supabase SQL Editor**, exactly as Claude gave it.
- [ ] My commit is signed — `git log --show-signature -1` shows **"Good signature"**.
- [ ] My PR targets **`develop`** (never `working`).
