/* global chrome */
// OmniMail Background Service Worker

// Open dashboard in a new tab when clicking extension toolbar icon
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL("index.html")
  });
});

// Setup placeholder for periodic background check (using alarms)
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "sync-emails") {
    // In the future, background email checks and unread count calculations can be performed here
    console.log("Background email sync fired...");
  }
});

// Register alarm when installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("sync-emails", {
    periodInMinutes: 5 // Run check every 5 minutes
  });
});
