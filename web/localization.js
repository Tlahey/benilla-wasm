// Browser-owned startup text. Original game translations come from the client data.
(() => {
  const messages = {
    en: {
      client_loading: 'Loading client…',
      client_failed: 'Could not start the client. Refresh the page or check the gateway.',
      preparing_client: 'Preparing client…',
      loading_world: 'Loading world / waiting for resources',
      interface_failed: 'Interface loading failed',
      loading_interface: 'Loading interface and addon files…',
      preparing_artwork: 'Preparing interface artwork…',
      preparing_fonts: 'Preparing fonts…',
      preparing_ui: 'Preparing interface…',
      loading_catalogs: 'Loading game catalogs…',
      preparing_login: 'Preparing login screen…',
      pending_files: 'Files loading: {count}',
      attempt: 'Attempt {count}',
      asset_budget_exhausted: 'Resource request time limit exceeded',
      asset_timeout: 'Resource request timed out',
      asset_empty: 'The gateway returned an empty resource',
      asset_network_error: 'Network error while loading a resource',
      asset_terminal: 'Resource loading stopped: retry limit reached or gateway error',
    },
    ru: {
      client_loading: 'Загрузка клиента…',
      client_failed: 'Не удалось запустить клиент. Обновите страницу или проверьте шлюз.',
      preparing_client: 'Подготовка клиента…',
      loading_world: 'Загрузка мира / ожидание ресурсов',
      interface_failed: 'Ошибка загрузки интерфейса',
      loading_interface: 'Загрузка интерфейса и файлов аддонов…',
      preparing_artwork: 'Подготовка изображений интерфейса…',
      preparing_fonts: 'Подготовка шрифтов…',
      preparing_ui: 'Подготовка интерфейса…',
      loading_catalogs: 'Загрузка игровых каталогов…',
      preparing_login: 'Подготовка экрана входа…',
      pending_files: 'Загружаются файлы: {count}',
      attempt: 'Попытка {count}',
      asset_budget_exhausted: 'Превышено время ожидания ресурса',
      asset_timeout: 'Истекло время ожидания ресурса',
      asset_empty: 'Шлюз вернул пустой ресурс',
      asset_network_error: 'Ошибка сети при загрузке ресурса',
      asset_terminal: 'Загрузка ресурса остановлена: исчерпаны попытки или ошибка шлюза',
    },
    fr: {
      client_loading: 'Chargement du client…',
      client_failed: 'Impossible de démarrer le client. Rechargez la page ou vérifiez la passerelle.',
      preparing_client: 'Préparation du client…',
      loading_world: 'Chargement du monde / attente des ressources',
      interface_failed: "Échec du chargement de l'interface",
      loading_interface: "Chargement de l'interface et des fichiers d'extension…",
      preparing_artwork: "Préparation des graphismes de l'interface…",
      preparing_fonts: 'Préparation des polices…',
      preparing_ui: "Préparation de l'interface…",
      loading_catalogs: 'Chargement des catalogues du jeu…',
      preparing_login: 'Préparation de l’écran de connexion…',
      pending_files: 'Fichiers en cours de chargement : {count}',
      attempt: 'Tentative {count}',
      asset_budget_exhausted: 'Délai de requête des ressources dépassé',
      asset_timeout: 'Délai d’attente d’une ressource dépassé',
      asset_empty: 'La passerelle a renvoyé une ressource vide',
      asset_network_error: 'Erreur réseau lors du chargement d’une ressource',
      asset_terminal: 'Chargement de la ressource arrêté : limite de tentatives atteinte ou erreur de la passerelle',
    },
  };
  const normalizeLocale = code => {
    if (code === 'ru' || code === 'ruRU') return 'ruRU';
    if (code === 'fr' || code === 'frFR') return 'frFR';
    return 'enUS';
  };
  let saved = 'enUS';
  try { saved = localStorage.getItem('benilla:state:v1:locale') || saved; }
  catch (_) { /* Storage restrictions must not prevent startup. */ }
  const locale = normalizeLocale(saved);
  const language = locale === 'ruRU' ? 'ru' : locale === 'frFR' ? 'fr' : 'en';
  document.documentElement.lang = language;
  globalThis.BENILLA_I18N = Object.freeze({
    locale,
    normalizeLocale,
    text(key, values = {}) {
      const template = messages[language][key] ?? messages.en[key] ?? key;
      return template.replace(/\{([a-z_]+)\}/g, (token, name) =>
        Object.hasOwn(values, name) ? String(values[name]) : token);
    },
  });
  const initial = document.getElementById('benilla-bootstrap-status');
  if (initial) initial.textContent = globalThis.BENILLA_I18N.text('client_loading');
})();
