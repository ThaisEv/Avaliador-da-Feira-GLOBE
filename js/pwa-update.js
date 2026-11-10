(() => {
  if (!("serviceWorker" in navigator) || !location.protocol.startsWith("http")) return;

  const form = document.querySelector("form");
  let formDirty = false;
  let reloadRequested = false;
  window.GLOBE_FORM_DIRTY = false;

  const notice = document.getElementById("appUpdateNotice");
  const showNotice = () => {
    if (!notice) return;
    notice.hidden = false;
  };
  const reloadSafely = () => {
    if (reloadRequested) return;
    if (formDirty || window.GLOBE_FORM_DIRTY) {
      showNotice();
      return;
    }
    reloadRequested = true;
    window.location.reload();
  };

  form?.addEventListener("input", () => {
    formDirty = true;
    window.GLOBE_FORM_DIRTY = true;
  });
  form?.addEventListener("change", () => {
    formDirty = true;
    window.GLOBE_FORM_DIRTY = true;
  });
  window.addEventListener("globe:form-saved", () => {
    formDirty = false;
    window.GLOBE_FORM_DIRTY = false;
  });
  document.getElementById("reloadAppButton")?.addEventListener("click", () => {
    formDirty = false;
    window.GLOBE_FORM_DIRTY = false;
    reloadSafely();
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    reloadSafely();
  });

  navigator.serviceWorker.register("./service-worker.js", { updateViaCache: "none" })
    .then(registration => {
      const checkForUpdate = () => registration.update().catch(() => undefined);
      checkForUpdate();
      window.setInterval(checkForUpdate, 5 * 60 * 1000);

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            showNotice();
          }
        });
      });

      if (registration.waiting) showNotice();
    })
    .catch(error => console.error("Não foi possível registrar o Service Worker.", error));
})();
