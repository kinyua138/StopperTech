# How to Deploy Your Frontend to Netlify

This guide provides step-by-step instructions for deploying the frontend of this project to Netlify.

### Project Configuration

This project has been pre-configured for a successful Netlify deployment. Here are the key files involved:

-   **`package.json`**: Contains the `build` script (`npm run build`) that prepares your frontend files for deployment.
-   **`build.js`**: A helper script that handles copying the `frontend` files to a `dist` directory and renaming `stopper.html` to `index.html`.
-   **`netlify.toml`**: The Netlify configuration file. It tells Netlify:
    -   To run the `npm run build` command.
    -   To deploy the `dist` directory.
    -   How to proxy API requests from `/api/*` to your backend server.

### Deployment Method 1: Git Integration (Recommended)

This is the best method as Netlify will automatically redeploy your site every time you push a change to your GitHub repository.

1.  **Push to GitHub**: Ensure all your latest code is on GitHub.
2.  **Log in to Netlify**: Go to your [Netlify dashboard](https://app.netlify.com/).
3.  **New Site from Git**:
    -   Click the **"Add new site"** button and select **"Import an existing project"**.
    -   Connect to your Git provider (GitHub).
    -   Select the repository for this project.
4.  **Configure Build Settings**:
    -   Netlify will automatically detect and display the settings from your `netlify.toml` file.
    -   **Build command**: Should be `npm run build`.
    -   **Publish directory**: Should be `dist`.
    -   You do not need to change anything here if the `netlify.toml` file is correct.
5.  **Deploy**: Click the **"Deploy site"** button.

Netlify will now build and deploy your frontend.

### Deployment Method 2: Manual Drag-and-Drop

Use this method if you want to quickly deploy without connecting to Git.

1.  **Build the Project Locally**:
    -   Open your terminal.
    -   Run `npm install` to ensure all dependencies are installed.
    -   Run `npm run build`. This will create a `dist` folder in your project.
2.  **Go to Netlify's Deploy Page**:
    -   Log in to your [Netlify dashboard](https://app.netlify.com/).
    -   Go to the **"Sites"** tab.
    -   Scroll down to the bottom where it says **"Want to deploy a new site without connecting to Git? Drag and drop your site output folder here"**.
3.  **Drag and Drop**: Drag the entire `dist` folder from your project into the box on the Netlify page.

### Final Check

After deploying, your frontend should be live. Remember that for the site to be fully functional (e.g., for the registration form to work), your backend must be deployed and running on Render, and the proxy URL in `netlify.toml` must be correct.
