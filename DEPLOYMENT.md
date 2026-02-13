# Backend Deployment Guide (Render)

## 1. Prerequisites
- GitHub account
- Render account
- MongoDB Atlas cluster
- AWS S3 bucket

## 2. Push Code to GitHub
Ensure this **Backend Repository** is pushed to GitHub.
- This repository should contain the `backend` code at the root level.
- Ensure `render.yaml` and `Dockerfile` are present.

```bash
git init
git add .
git commit -m "Initial commit for backend"
git branch -M main
git remote add origin <YOUR_BACKEND_REPO_URL>
git push -u origin main
```

## 3. Deployment (Render)
1.  Log in to [Render](https://dashboard.render.com/).
2.  Click **New +** -> **Web Service**.
3.  Connect your **Backend Repository**.
4.  Render should detect `render.yaml` automatically.
5.  **Environment Variables**:
    Add the following environment variables (copy values from your local `.env`):
    -   `MONGODB_URI`
    -   `AWS_ACCESS_KEY_ID`
    -   `AWS_SECRET_ACCESS_KEY`
    -   `AWS_REGION`
    -   `AWS_S3_BUCKET_NAME`
    -   `PORT`: `5002`
    -   `LIBREOFFICE_PATH`: `/usr/bin/libreoffice`

6.  Click **Create Web Service**.
7.  Wait for the build to finish. Once deployed, copy your backend URL (e.g., `https://receipt-generator-backend.onrender.com`).
