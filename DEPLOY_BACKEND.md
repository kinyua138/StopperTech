# How to Deploy Your Node.js Backend to Render

This guide provides step-by-step instructions for deploying the backend of this project to Render.

### Step 1: Push Your Code to a GitHub Repository

Before you can deploy to Render, your project code must be stored in a GitHub repository.

### Step 2: Create a New Web Service on Render

1.  Go to the [Render Dashboard](https://dashboard.render.com/) and log in.
2.  Click the **"New +"** button in the top right.
3.  Select **"Web Service"** from the dropdown menu.
4.  Connect your GitHub account if you haven't already, then select the repository for this project.

### Step 3: Configure the Web Service

You will be taken to a configuration screen. Fill out the form with the following settings:

-   **Name**: A unique name for your service (e.g., `stopper-tech-backend`).
-   **Region**: Choose a server region (e.g., Ohio, USA).
-   **Branch**: Select the Git branch you want to deploy (e.g., `main` or `master`).
-   **Root Directory**: Set this to `./backend`. This is very important as it tells Render to look inside your `backend` folder.
-   **Runtime**: Select `Node`.
-   **Build Command**: `npm install`
-   **Start Command**: `node server.js`

### Step 4: Add Environment Variables

Your backend uses a `.env` file for sensitive information like database connection strings. You must add these variables to Render's environment.

1.  Scroll down to the **"Environment"** section on the configuration page.
2.  Click **"Add Environment Variable"**.
3.  For each variable in your local `.env` file, create a corresponding entry in Render. For example:
    -   **Key**: `MONGO_URI`, **Value**: `your_mongodb_connection_string`
    -   **Key**: `PORT`, **Value**: `10000` (Render provides the port, but you can set it)

### Step 5: Deploy

1.  Review your settings.
2.  Click the **"Create Web Service"** button at the bottom of the page.

Render will now pull your code from GitHub, run the build command, and start your server. You can view the deployment progress in the "Logs" tab.

### Step 6: Update Your Frontend Configuration

After a successful deployment, Render will provide you with a public URL for your backend (it will look something like `https://your-service-name.onrender.com`).

You must update the `netlify.toml` file in your project to point the proxy to this new URL.

1.  Open `netlify.toml`.
2.  Find the `[[redirects]]` rule for `/api/*`.
3.  Replace the `to` value with your new Render URL:

    ```toml
    [[redirects]]
      from = "/api/*"
      to = "https://your-service-name.onrender.com/api/:splat" # <-- UPDATE THIS URL
      status = 200
      force = true
    ```
4.  Commit and push this change to GitHub. Netlify will redeploy your frontend with the updated backend link.
