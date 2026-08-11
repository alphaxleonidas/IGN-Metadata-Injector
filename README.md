# IGN Metadata Injector

Injects IGN data inside Steam and Epic's game page.

## Features: 
- IGN score and user rating
- IGN leaderboard rank
- ESRB rating
- Developer name
- HowLongToBeat time
- HLTB Leisure Time
- Steam reviews (extracted from the page)
- Curated selection of location options
- Source overrides for unavailable games
- Choose which item you want in your main page
- Supports both Steam and Epic stores
- Select individual preferences for each store.

  **Plan**
  - Better searching and name detection
  - ESRB Rating description
  - IGN Game Summary
  - IGN Review Summary
  - IGN Review Grading
  - Genres
  - Platforms
  - Selection of individual element location
  - Toggle all elements in a single place
  - Optimization
    
<p align="center">
  <img src="https://github.com/user-attachments/assets/8967d059-8a40-47bd-8053-ac3764a723ce" alt="Epic version" width="49%" height="300" style="object-fit: cover;" />
  <img src="https://github.com/user-attachments/assets/a06a1d09-3976-4c17-a5b6-292e84059506" alt="Steam version" width="49%" height="300" style="object-fit: cover;" />
</p>


<!--
<img width="1241" height="897" alt="Screenshot from 2026-08-08 16-23-06" src="https://github.com/user-attachments/assets/8967d059-8a40-47bd-8053-ac3764a723ce" />
<img width="1401" height="888" alt="Screenshot from 2026-08-08 16-23-26" src="https://github.com/user-attachments/assets/a06a1d09-3976-4c17-a5b6-292e84059506" />
-->

# Installation:

 ## One Click Userscript: [Install](https://github.com/alphaxleonidas/IGN-Metadata-Injector/raw/refs/heads/main/userscript/ign-metadata-injector.user.js)

 
   **Requirements:** Tampermonkey or some userscript manager

 - Supports auto-updates

# Chrome/Chromium 

- Download the `chromium` version from the [Releases](https://github.com/alphaxleonidas/IGN-Metadata-Injector/releases) section
- Extract it.
- Open a new tab and go to `chrome://extensions`
- Enable `Developer mode` on the top right
- Now you will see some new options. Click `Load Unpacked`.
- Select the extracted folder.
- The extension is now loaded and should work permanently.

Note: Make sure you select the root folder of the extracted file. 

# Steam [Desktop App]
*Ironically, this extension can also be installed on steam, which uses chromium browser underneath. The process is almost identical except for a couple of workarounds*.

So, the idea is to make Steam app open the main chromium browser from which we can load our extension.

- Open your steam app and `right click` any clickable link.
- Select `Open link in a new tab`.
- This would pop up a mini-browser (not our end-goal).
- Now go to the URL bar and type `https://chromewebstore.google.com/detail/ublock-origin-lite/ddkjiahejlhfcafbddmgiahcphecmpfh?hl=en` or a link to any chrome webstore extension.
- Click `Add to Chrome`.
- A popup will appear asking you to save. Choose any location, it does not matter in our case.
- Now the extension will be installed and a new Chromium window will appear. This is where we can follow steps from [#Chrome/Chromium](https://github.com/alphaxleonidas/IGN-Metadata-Injector#chromechromium)
# Firefox 
- Download the `firefox` version from the [Releases](https://github.com/alphaxleonidas/IGN-Metadata-Injector/releases) section
- Open `about:config`
- Set `xpinstall.signatures.required` to `false`
- Go to `about:addons`
- Click the `gear` icon. Select `Install add-on from file`.
- Select the .zip file that was downloaded.
- Now the add-on should run.

Note: If the firefox does not recognize the .zip file type, you can rename the .zip to .xpi and it should work fine. .xpi is bacially a zip file with a changed file extension name.


# Build Instructions:
[For the userscript]

- Install `node.js`.
- Clone the repo and `cd` into project's root directory 
  ```
  git clone https://www.github.com/alphaxleonidas/ign-metadata-injector.git
  cd IGN-Metadata-Injector
  ```
- Run the build command :
  ```
  node build.js
  ```
- It will create a file in `PROJECTROOTFOLDER/userscript` named as `ign-metadata-injector.user.js`.
