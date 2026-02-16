self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "KCAL AI", body: "Rappel nutrition" };
  }

  const title = data.title || "KCAL AI";
  const options = {
    body: data.body || "Ton rappel nutrition est pret.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "kcal-ai-reminder",
    data: {
      url: data.url || "/dashboard"
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/dashboard";
  event.waitUntil(clients.openWindow(url));
});
