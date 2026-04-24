// ============================================
// ByteSky Cloud Platform - Frontend JavaScript (FINAL CORRECTED)
// ============================================

// --- API Configuration ---
const API_URL = (() => {
    const { protocol, hostname, port, origin } = window.location;

    // Live Server / static file dev mode
    if (protocol === 'file:' || port === '5500' || port === '5501' || port === '5502') {
        return 'http://localhost:5000/api';
    }

    // Docker/Nginx or same-origin deployment
    if (!port || port === '80' || port === '443') {
        return `${origin}/api`;
    }

    // Frontend served from a non-backend dev port
    if (hostname === '127.0.0.1' || hostname === 'localhost') {
        return 'http://localhost:5000/api';
    }

    return `${origin}/api`;
})();
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51T5lPlFRBdmpZ6N0v3l17Z2O7yYFCCSSGIxoDDCkRPauDlYffZjX3So5KiQaqKk9njO3iS63un695KIwVVJlJ5C600Xzo5DnTN';
const DEFAULT_GOOGLE_CLIENT_ID = '54516308982-1q21ghba191vu089q332jvrqdvaasj1q.apps.googleusercontent.com';
const GOOGLE_AUTH_REQUEST_TIMEOUT_MS = 15000;
const PUBLIC_PAGES = new Set(['home', 'login', 'register']);
let currentUser = null;
let token = localStorage.getItem('bytesky_token') || localStorage.getItem('token');
let metricsChart = null;
let currentTicketId = null;
let ticketCurrentPage = 1;
let ticketTotalPages = 1;
let ticketSearchDebounce = null;
let adminTicketCurrentPage = 1;
let adminTicketTotalPages = 1;
let adminTicketSearchDebounce = null;
let activeContainerSessions = [];
let vmLaunchInProgress = false;
let stripeClientPromise = null;
let googleInitialized = false;
let googleInitAttempts = 0;
let clientConfigPromise = null;
let saasStatusRefreshInterval = null;
let selectedSaaSApp = null;
let billing = JSON.parse(localStorage.getItem('bytesky_billing') || '[]');
let saasIntegrations = JSON.parse(localStorage.getItem('bytesky_saas_integrations') || '[]');
let marketplaceServices = [];
let activeMarketplaceSessions = [];
let authSessions = [];
let currentAuthSessionId = localStorage.getItem('bytesky_session_id') || null;

// Storage variables
let allStorageFiles = [];
let storageView = 'list';
let selectedStorageIds = [];
let activeMonitoringMetric = 'cpu';
const THEME_STORAGE_KEY = 'bytesky_theme';
const DEVICE_ID_STORAGE_KEY = 'bytesky_device_id';
const SESSION_ID_STORAGE_KEY = 'bytesky_session_id';
const SIDEBAR_COLLAPSE_STORAGE_KEY = 'bytesky_sidebar_collapsed';
const SIDEBAR_DISMISS_BREAKPOINT = 1024;
const SYSTEM_THEME_QUERY = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;
const MARKETING_SECTION_IDS = new Set([
    'home-compute',
    'home-network',
    'home-security',
    'home-pricing',
    'home-docs'
]);
const AUTH_TOKEN_STORAGE_KEY = 'bytesky_token';
const LEGACY_AUTH_TOKEN_STORAGE_KEY = 'token';
const AUTH_USER_STORAGE_KEY = 'bytesky_user';
const LANGUAGE_STORAGE_KEY = 'bytesky_language';
const REGION_STORAGE_KEY = 'bytesky_region';
const DEFAULT_LOCALE = 'en-US';
const DEFAULT_REGION = 'us';
const EN_US_STRINGS = {
    'general.unknown': 'Unknown',
    'general.unknownTime': 'Unknown time',
    'general.justNow': 'Just now',
    'general.inMoment': 'In a moment',
    'general.enabled': 'enabled',
    'general.disabled': 'disabled',
    'nav.section.core': 'Core',
    'nav.section.management': 'Management',
    'nav.section.settings': 'Settings',
    'nav.dashboard': 'Dashboard',
    'nav.compute': 'Compute',
    'nav.network': 'Network & VPC',
    'nav.storage': 'Storage',
    'nav.monitoring': 'Monitoring',
    'nav.support': 'Support',
    'nav.billing': 'Billing',
    'nav.marketplace': 'Marketplace',
    'nav.iam': 'IAM',
    'nav.profile': 'Profile',
    'nav.admin': 'Admin Panel',
    'profile.accountSettings': 'Account Settings',
    'profile.editProfile': 'Edit Profile',
    'profile.personalInformation': 'Personal Information',
    'profile.fullName': 'Full Name',
    'profile.emailAddress': 'Email Address',
    'profile.phoneNumber': 'Phone Number',
    'profile.jobTitle': 'Job Title',
    'profile.company': 'Company',
    'profile.timezone': 'Timezone',
    'profile.saveChanges': 'Save Changes',
    'profile.cancel': 'Cancel',
    'profile.accountDetails': 'Account Details',
    'profile.accountId': 'Account ID',
    'profile.accountType': 'Account Type',
    'profile.memberSince': 'Member Since',
    'profile.lastLogin': 'Last Login',
    'profile.securitySettings': 'Security Settings',
    'profile.changePassword': 'Change Password',
    'profile.lastChanged': 'Last changed:',
    'profile.never': 'Never',
    'profile.uniquePasswordHint': 'Use a strong, unique password',
    'profile.currentPassword': 'Current Password',
    'profile.newPassword': 'New Password',
    'profile.confirmNewPassword': 'Confirm New Password',
    'profile.updatePassword': 'Update Password',
    'profile.twoFactorAuth': 'Two-Factor Authentication',
    'profile.twoFactorDescription': 'Add an extra layer of security via authenticator app',
    'profile.twoFactorCurrently': '2FA is currently',
    'profile.twoFactorEnabledState': 'enabled',
    'profile.twoFactorDisabledState': 'disabled',
    'profile.twoFactorEnabled': '2FA is enabled',
    'profile.twoFactorDisabled': '2FA is not enabled',
    'profile.loginAlerts': 'Login Alerts',
    'profile.loginAlertsDescription': 'Get notified when a new device signs into your account',
    'profile.newDeviceLogin': 'Email me on new device login',
    'profile.failedLogin': 'Email me on failed login attempts',
    'profile.loginAlertsSaved': 'Login alert preferences are saved to your account.',
    'profile.loginAlertsSaving': 'Saving login alert preferences...',
    'profile.loginAlertsUpdated': 'Login alerts updated',
    'profile.activeSessions': 'Active Sessions',
    'profile.activeSessionsDescription': 'Devices currently signed in to your account.',
    'profile.activeSessionsUpdated': 'Updated from live session records',
    'profile.preferences': 'Preferences',
    'profile.notificationPreferences': 'Notification Preferences',
    'profile.billingAlerts': 'Email notifications for billing alerts',
    'profile.securityAlerts': 'Email notifications for security alerts',
    'profile.smsAlerts': 'SMS notifications for critical events',
    'profile.marketingEmails': 'Marketing emails and product updates',
    'profile.appearance': 'Appearance',
    'profile.lightMode': 'Light Mode',
    'profile.darkMode': 'Dark Mode',
    'profile.systemDefault': 'System Default',
    'profile.languageRegion': 'Language & Region',
    'profile.languageLabel': 'Language',
    'profile.regionLabel': 'Region',
    'profile.languageUpdated': 'Language updated',
    'profile.regionUpdated': 'Region updated',
    'profile.resourceUsage': 'Resource Usage',
    'profile.sshKeys': 'SSH Keys',
    'profile.noSshKeysFound': 'No SSH keys found. Add one to get started.',
    'profile.noSshKeysFoundCreate': 'No SSH keys found. Create one to get started.',
    'profile.sshKeysDescription': 'Securely connect to instances without a password.',
    'profile.generatedSshKey': 'Generated SSH key',
    'profile.manualKeyImport': 'Manual key import',
    'profile.addedOn': 'Added on',
    'profile.created': 'Created',
    'profile.expires': 'Expires',
    'profile.currentSession': 'Current session',
    'profile.unknownDevice': 'Unknown device',
    'profile.unknownBrowser': 'Unknown browser',
    'profile.unknownOS': 'Unknown OS',
    'profile.unknownLocation': 'Unknown location',
    'profile.currentDevice': 'Current device',
    'profile.delete': 'Delete',
    'profile.deleteKey': 'Delete Key',
    'profile.revoke': 'Revoke',
    'profile.dangerZone': 'Danger Zone',
    'profile.accountDeletionWarning': 'Once you delete your account, there is no going back. All data, instances, and resources will be permanently deleted.',
    'profile.deleteAccount': 'Delete Account',
    'profile.noActiveSessions': 'No active sessions right now.',
    'profile.noActiveSessionsDescription': 'When you sign in on a device, it will appear here with live session details.',
    'profile.sshKeyAdded': 'SSH key added successfully',
    'profile.sshKeyDeleted': 'SSH key deleted',
    'profile.editModeEnabled': 'Edit mode enabled. Make your changes and click Save.',
    'profile.nameAndEmailRequired': 'Name and email are required',
    'profile.validEmailRequired': 'Enter a valid email address',
    'profile.failedToUpdateProfile': 'Failed to update profile',
    'profile.errorUpdatingProfile': 'Error updating profile',
    'profile.profileUpdated': 'Profile updated successfully!',
    'profile.changesCancelled': 'Changes cancelled',
    'profile.passwordFieldsRequired': 'Please fill all fields',
    'profile.passwordsDoNotMatch': 'New passwords do not match',
    'profile.passwordMinLength': 'Password must be at least 8 characters',
    'profile.passwordChanged': 'Password changed successfully!',
    'profile.errorChangingPassword': 'Error changing password',
    'profile.accountDeletionCancelled': 'Account deletion cancelled',
    'profile.accountDeletionInitiated': 'Account deletion initiated. You will receive a confirmation email.',
    'profile.signInToUpdateLoginAlerts': 'Please sign in to update login alerts',
    'profile.unableToLoadLoginAlerts': 'Unable to load login alert preferences',
    'profile.unableToSaveLoginAlerts': 'Unable to save login alert preferences',
    'profile.loginAlertsLoaded': 'Login alert preferences are saved to your account.',
    'profile.loginAlertsSavedMessage': 'Login alert preferences saved.',
    'profile.loginAlertsUpdateMessage': 'Login alerts updated',
    'profile.twoFAEnabledMessage': '2FA enabled successfully',
    'profile.twoFADisabledMessage': '2FA disabled',
    'profile.twoFAEnabledStatus': '2FA is enabled',
    'profile.twoFADisabledStatus': '2FA is not enabled',
    'profile.createdLabel': 'Created',
    'profile.connectedAt': 'Connected',
    'profile.expiresLabel': 'Expires',
    'profile.currentLabel': 'Current',
    'profile.revokeLabel': 'Revoke',
    'profile.selectLanguage': 'Language',
    'profile.selectRegion': 'Region',
    'language.englishUS': 'English (US)',
    'language.englishUK': 'English (UK)',
    'language.spanish': 'Spanish',
    'language.french': 'French',
    'language.german': 'German',
    'region.unitedStates': 'United States',
    'region.unitedKingdom': 'United Kingdom',
    'region.india': 'India',
    'region.germany': 'Germany'
};
const ES_STRINGS = {
    ...EN_US_STRINGS,
    'nav.section.core': 'Núcleo',
    'nav.section.management': 'Administración',
    'nav.section.settings': 'Ajustes',
    'nav.dashboard': 'Panel',
    'nav.compute': 'Cómputo',
    'nav.network': 'Red y VPC',
    'nav.storage': 'Almacenamiento',
    'nav.monitoring': 'Supervisión',
    'nav.support': 'Soporte',
    'nav.billing': 'Facturación',
    'nav.marketplace': 'Marketplace',
    'nav.profile': 'Perfil',
    'nav.admin': 'Panel de admin',
    'profile.accountSettings': 'Configuración de la cuenta',
    'profile.editProfile': 'Editar perfil',
    'profile.personalInformation': 'Información personal',
    'profile.fullName': 'Nombre completo',
    'profile.emailAddress': 'Correo electrónico',
    'profile.phoneNumber': 'Número de teléfono',
    'profile.jobTitle': 'Puesto',
    'profile.company': 'Empresa',
    'profile.timezone': 'Zona horaria',
    'profile.saveChanges': 'Guardar cambios',
    'profile.cancel': 'Cancelar',
    'profile.accountDetails': 'Detalles de la cuenta',
    'profile.accountId': 'ID de cuenta',
    'profile.accountType': 'Tipo de cuenta',
    'profile.memberSince': 'Miembro desde',
    'profile.lastLogin': 'Último inicio de sesión',
    'profile.securitySettings': 'Configuración de seguridad',
    'profile.changePassword': 'Cambiar contraseña',
    'profile.lastChanged': 'Último cambio:',
    'profile.never': 'Nunca',
    'profile.uniquePasswordHint': 'Usa una contraseña segura y única',
    'profile.currentPassword': 'Contraseña actual',
    'profile.newPassword': 'Nueva contraseña',
    'profile.confirmNewPassword': 'Confirmar nueva contraseña',
    'profile.updatePassword': 'Actualizar contraseña',
    'profile.twoFactorAuth': 'Autenticación de dos factores',
    'profile.twoFactorDescription': 'Añade una capa extra de seguridad con una app autenticadora',
    'profile.twoFactorCurrently': '2FA está actualmente',
    'profile.twoFactorEnabledState': 'activada',
    'profile.twoFactorDisabledState': 'desactivada',
    'profile.twoFactorEnabled': '2FA está activada',
    'profile.twoFactorDisabled': '2FA no está activada',
    'profile.loginAlerts': 'Alertas de inicio de sesión',
    'profile.loginAlertsDescription': 'Recibe notificaciones cuando un nuevo dispositivo inicie sesión en tu cuenta',
    'profile.newDeviceLogin': 'Enviarme un correo al iniciar sesión desde un nuevo dispositivo',
    'profile.failedLogin': 'Enviarme un correo en intentos fallidos',
    'profile.loginAlertsSaved': 'Las preferencias de alertas de inicio de sesión se guardan en tu cuenta.',
    'profile.loginAlertsSaving': 'Guardando preferencias de alertas de inicio de sesión...',
    'profile.loginAlertsUpdated': 'Alertas de inicio de sesión actualizadas',
    'profile.activeSessions': 'Sesiones activas',
    'profile.activeSessionsDescription': 'Dispositivos conectados actualmente a tu cuenta.',
    'profile.activeSessionsUpdated': 'Actualizado con registros de sesiones en vivo',
    'profile.preferences': 'Preferencias',
    'profile.notificationPreferences': 'Preferencias de notificación',
    'profile.languageRegion': 'Idioma y región',
    'profile.languageLabel': 'Idioma',
    'profile.regionLabel': 'Región',
    'profile.languageUpdated': 'Idioma actualizado',
    'profile.regionUpdated': 'Región actualizada',
    'profile.resourceUsage': 'Uso de recursos',
    'profile.sshKeys': 'Claves SSH',
    'profile.noSshKeysFound': 'No se encontraron claves SSH. Añade una para empezar.',
    'profile.noSshKeysFoundCreate': 'No se encontraron claves SSH. Crea una para empezar.',
    'profile.addedOn': 'Añadido el',
    'profile.created': 'Creado',
    'profile.expires': 'Expira',
    'profile.currentSession': 'Sesión actual',
    'profile.unknownDevice': 'Dispositivo desconocido',
    'profile.unknownBrowser': 'Navegador desconocido',
    'profile.unknownOS': 'Sistema operativo desconocido',
    'profile.unknownLocation': 'Ubicación desconocida',
    'profile.currentDevice': 'Dispositivo actual',
    'profile.delete': 'Eliminar',
    'profile.deleteKey': 'Eliminar clave',
    'profile.revoke': 'Revocar',
    'profile.noActiveSessions': 'No hay sesiones activas ahora.',
    'profile.noActiveSessionsDescription': 'Cuando inicies sesión en un dispositivo, aparecerá aquí con detalles en vivo.',
    'profile.sshKeyAdded': 'Clave SSH añadida correctamente',
    'profile.sshKeyDeleted': 'Clave SSH eliminada',
    'profile.editModeEnabled': 'Modo de edición activado. Haz tus cambios y pulsa Guardar.',
    'profile.nameAndEmailRequired': 'El nombre y el correo son obligatorios',
    'profile.validEmailRequired': 'Introduce una dirección de correo válida',
    'profile.failedToUpdateProfile': 'No se pudo actualizar el perfil',
    'profile.errorUpdatingProfile': 'Error al actualizar el perfil',
    'profile.profileUpdated': '¡Perfil actualizado correctamente!',
    'profile.changesCancelled': 'Cambios cancelados',
    'profile.passwordFieldsRequired': 'Rellena todos los campos',
    'profile.passwordsDoNotMatch': 'Las nuevas contraseñas no coinciden',
    'profile.passwordMinLength': 'La contraseña debe tener al menos 8 caracteres',
    'profile.passwordChanged': '¡Contraseña cambiada correctamente!',
    'profile.errorChangingPassword': 'Error al cambiar la contraseña',
    'profile.signInToUpdateLoginAlerts': 'Inicia sesión para actualizar las alertas de inicio de sesión',
    'profile.unableToLoadLoginAlerts': 'No se pudieron cargar las preferencias de alertas de inicio de sesión',
    'profile.unableToSaveLoginAlerts': 'No se pudieron guardar las preferencias de alertas de inicio de sesión',
    'profile.loginAlertsLoaded': 'Las preferencias de alertas de inicio de sesión se guardan en tu cuenta.',
    'profile.loginAlertsSavedMessage': 'Preferencias de alertas de inicio de sesión guardadas.',
    'profile.loginAlertsUpdateMessage': 'Alertas de inicio de sesión actualizadas',
    'profile.twoFAEnabledMessage': '2FA activada correctamente',
    'profile.twoFADisabledMessage': '2FA desactivada',
    'profile.twoFAEnabledStatus': '2FA está activada',
    'profile.twoFADisabledStatus': '2FA no está activada',
    'profile.createdLabel': 'Creado',
    'profile.expiresLabel': 'Expira',
    'profile.currentLabel': 'Actual',
    'profile.revokeLabel': 'Revocar',
    'profile.selectLanguage': 'Idioma',
    'profile.selectRegion': 'Región',
    'language.englishUS': 'Inglés (EE. UU.)',
    'language.englishUK': 'Inglés (Reino Unido)',
    'language.spanish': 'Español',
    'language.french': 'Francés',
    'language.german': 'Alemán',
    'region.unitedStates': 'Estados Unidos',
    'region.unitedKingdom': 'Reino Unido',
    'region.india': 'India',
    'region.germany': 'Alemania'
};
const FR_STRINGS = {
    ...EN_US_STRINGS,
    'nav.section.core': 'Noyau',
    'nav.section.management': 'Gestion',
    'nav.section.settings': 'Paramètres',
    'nav.dashboard': 'Tableau de bord',
    'nav.compute': 'Calcul',
    'nav.network': 'Réseau et VPC',
    'nav.storage': 'Stockage',
    'nav.monitoring': 'Surveillance',
    'nav.support': 'Assistance',
    'nav.billing': 'Facturation',
    'nav.marketplace': 'Marketplace',
    'nav.profile': 'Profil',
    'nav.admin': 'Panneau admin',
    'profile.accountSettings': 'Paramètres du compte',
    'profile.editProfile': 'Modifier le profil',
    'profile.personalInformation': 'Informations personnelles',
    'profile.fullName': 'Nom complet',
    'profile.emailAddress': 'Adresse e-mail',
    'profile.phoneNumber': 'Numéro de téléphone',
    'profile.jobTitle': 'Poste',
    'profile.company': 'Entreprise',
    'profile.timezone': 'Fuseau horaire',
    'profile.saveChanges': 'Enregistrer les modifications',
    'profile.cancel': 'Annuler',
    'profile.accountDetails': 'Détails du compte',
    'profile.accountId': 'ID du compte',
    'profile.accountType': 'Type de compte',
    'profile.memberSince': 'Membre depuis',
    'profile.lastLogin': 'Dernière connexion',
    'profile.securitySettings': 'Paramètres de sécurité',
    'profile.changePassword': 'Modifier le mot de passe',
    'profile.lastChanged': 'Dernière modification :',
    'profile.never': 'Jamais',
    'profile.uniquePasswordHint': 'Utilisez un mot de passe fort et unique',
    'profile.currentPassword': 'Mot de passe actuel',
    'profile.newPassword': 'Nouveau mot de passe',
    'profile.confirmNewPassword': 'Confirmer le nouveau mot de passe',
    'profile.updatePassword': 'Mettre à jour le mot de passe',
    'profile.twoFactorAuth': 'Authentification à deux facteurs',
    'profile.twoFactorDescription': "Ajoutez une couche de sécurité supplémentaire via l'application d'authentification",
    'profile.twoFactorCurrently': 'La 2FA est actuellement',
    'profile.twoFactorEnabledState': 'activée',
    'profile.twoFactorDisabledState': 'désactivée',
    'profile.twoFactorEnabled': 'La 2FA est activée',
    'profile.twoFactorDisabled': 'La 2FA n’est pas activée',
    'profile.loginAlerts': 'Alertes de connexion',
    'profile.loginAlertsDescription': 'Recevez une notification lorsqu’un nouvel appareil se connecte à votre compte',
    'profile.newDeviceLogin': 'M’envoyer un e-mail lors d’une connexion depuis un nouvel appareil',
    'profile.failedLogin': 'M’envoyer un e-mail lors d’échecs de connexion',
    'profile.loginAlertsSaved': 'Les préférences d’alertes de connexion sont enregistrées dans votre compte.',
    'profile.loginAlertsSaving': 'Enregistrement des préférences d’alertes de connexion...',
    'profile.loginAlertsUpdated': 'Alertes de connexion mises à jour',
    'profile.activeSessions': 'Sessions actives',
    'profile.activeSessionsDescription': 'Appareils actuellement connectés à votre compte.',
    'profile.activeSessionsUpdated': 'Mis à jour à partir des sessions en direct',
    'profile.preferences': 'Préférences',
    'profile.notificationPreferences': 'Préférences de notification',
    'profile.languageRegion': 'Langue et région',
    'profile.languageLabel': 'Langue',
    'profile.regionLabel': 'Région',
    'profile.languageUpdated': 'Langue mise à jour',
    'profile.regionUpdated': 'Région mise à jour',
    'profile.resourceUsage': 'Utilisation des ressources',
    'profile.sshKeys': 'Clés SSH',
    'profile.noSshKeysFound': 'Aucune clé SSH trouvée. Ajoutez-en une pour commencer.',
    'profile.noSshKeysFoundCreate': 'Aucune clé SSH trouvée. Créez-en une pour commencer.',
    'profile.addedOn': 'Ajouté le',
    'profile.created': 'Créé',
    'profile.expires': 'Expire',
    'profile.currentSession': 'Session actuelle',
    'profile.unknownDevice': 'Appareil inconnu',
    'profile.unknownBrowser': 'Navigateur inconnu',
    'profile.unknownOS': 'Système d’exploitation inconnu',
    'profile.unknownLocation': 'Emplacement inconnu',
    'profile.currentDevice': 'Appareil actuel',
    'profile.delete': 'Supprimer',
    'profile.deleteKey': 'Supprimer la clé',
    'profile.revoke': 'Révoquer',
    'profile.noActiveSessions': 'Aucune session active pour le moment.',
    'profile.noActiveSessionsDescription': 'Lorsque vous vous connectez sur un appareil, il apparaîtra ici avec les détails en direct.',
    'profile.sshKeyAdded': 'Clé SSH ajoutée avec succès',
    'profile.sshKeyDeleted': 'Clé SSH supprimée',
    'profile.editModeEnabled': 'Mode édition activé. Faites vos modifications puis cliquez sur Enregistrer.',
    'profile.nameAndEmailRequired': 'Le nom et l’e-mail sont obligatoires',
    'profile.validEmailRequired': 'Saisissez une adresse e-mail valide',
    'profile.failedToUpdateProfile': 'Impossible de mettre à jour le profil',
    'profile.errorUpdatingProfile': 'Erreur lors de la mise à jour du profil',
    'profile.profileUpdated': 'Profil mis à jour avec succès !',
    'profile.changesCancelled': 'Modifications annulées',
    'profile.passwordFieldsRequired': 'Veuillez remplir tous les champs',
    'profile.passwordsDoNotMatch': 'Les nouveaux mots de passe ne correspondent pas',
    'profile.passwordMinLength': 'Le mot de passe doit comporter au moins 8 caractères',
    'profile.passwordChanged': 'Mot de passe modifié avec succès !',
    'profile.errorChangingPassword': 'Erreur lors du changement de mot de passe',
    'profile.signInToUpdateLoginAlerts': 'Veuillez vous connecter pour mettre à jour les alertes de connexion',
    'profile.unableToLoadLoginAlerts': 'Impossible de charger les préférences d’alertes de connexion',
    'profile.unableToSaveLoginAlerts': 'Impossible d’enregistrer les préférences d’alertes de connexion',
    'profile.loginAlertsLoaded': 'Les préférences d’alertes de connexion sont enregistrées dans votre compte.',
    'profile.loginAlertsSavedMessage': 'Préférences d’alertes de connexion enregistrées.',
    'profile.loginAlertsUpdateMessage': 'Alertes de connexion mises à jour',
    'profile.twoFAEnabledMessage': 'La 2FA a été activée',
    'profile.twoFADisabledMessage': 'La 2FA a été désactivée',
    'profile.twoFAEnabledStatus': 'La 2FA est activée',
    'profile.twoFADisabledStatus': 'La 2FA n’est pas activée',
    'profile.createdLabel': 'Créé',
    'profile.expiresLabel': 'Expire',
    'profile.currentLabel': 'Actuelle',
    'profile.revokeLabel': 'Révoquer',
    'profile.selectLanguage': 'Langue',
    'profile.selectRegion': 'Région',
    'language.englishUS': 'Anglais (États-Unis)',
    'language.englishUK': 'Anglais (Royaume-Uni)',
    'language.spanish': 'Espagnol',
    'language.french': 'Français',
    'language.german': 'Allemand',
    'region.unitedStates': 'États-Unis',
    'region.unitedKingdom': 'Royaume-Uni',
    'region.india': 'Inde',
    'region.germany': 'Allemagne'
};
const DE_STRINGS = {
    ...EN_US_STRINGS,
    'nav.section.core': 'Kern',
    'nav.section.management': 'Verwaltung',
    'nav.section.settings': 'Einstellungen',
    'nav.dashboard': 'Dashboard',
    'nav.compute': 'Compute',
    'nav.network': 'Netzwerk & VPC',
    'nav.storage': 'Speicher',
    'nav.monitoring': 'Überwachung',
    'nav.support': 'Support',
    'nav.billing': 'Abrechnung',
    'nav.marketplace': 'Marketplace',
    'nav.profile': 'Profil',
    'nav.admin': 'Admin-Panel',
    'profile.accountSettings': 'Kontoeinstellungen',
    'profile.editProfile': 'Profil bearbeiten',
    'profile.personalInformation': 'Persönliche Informationen',
    'profile.fullName': 'Vollständiger Name',
    'profile.emailAddress': 'E-Mail-Adresse',
    'profile.phoneNumber': 'Telefonnummer',
    'profile.jobTitle': 'Position',
    'profile.company': 'Unternehmen',
    'profile.timezone': 'Zeitzone',
    'profile.saveChanges': 'Änderungen speichern',
    'profile.cancel': 'Abbrechen',
    'profile.accountDetails': 'Kontodetails',
    'profile.accountId': 'Konto-ID',
    'profile.accountType': 'Kontotyp',
    'profile.memberSince': 'Mitglied seit',
    'profile.lastLogin': 'Letzte Anmeldung',
    'profile.securitySettings': 'Sicherheitseinstellungen',
    'profile.changePassword': 'Passwort ändern',
    'profile.lastChanged': 'Zuletzt geändert:',
    'profile.never': 'Nie',
    'profile.uniquePasswordHint': 'Verwende ein starkes, einzigartiges Passwort',
    'profile.currentPassword': 'Aktuelles Passwort',
    'profile.newPassword': 'Neues Passwort',
    'profile.confirmNewPassword': 'Neues Passwort bestätigen',
    'profile.updatePassword': 'Passwort aktualisieren',
    'profile.twoFactorAuth': 'Zwei-Faktor-Authentifizierung',
    'profile.twoFactorDescription': 'Füge eine zusätzliche Sicherheitsebene über eine Authenticator-App hinzu',
    'profile.twoFactorCurrently': '2FA ist derzeit',
    'profile.twoFactorEnabledState': 'aktiviert',
    'profile.twoFactorDisabledState': 'deaktiviert',
    'profile.twoFactorEnabled': '2FA ist aktiviert',
    'profile.twoFactorDisabled': '2FA ist nicht aktiviert',
    'profile.loginAlerts': 'Anmeldebenachrichtigungen',
    'profile.loginAlertsDescription': 'Benachrichtige mich, wenn sich ein neues Gerät in dein Konto einloggt',
    'profile.newDeviceLogin': 'E-Mail bei Anmeldung von einem neuen Gerät',
    'profile.failedLogin': 'E-Mail bei fehlgeschlagenen Anmeldeversuchen',
    'profile.loginAlertsSaved': 'Die Einstellungen für Anmeldebenachrichtigungen sind in deinem Konto gespeichert.',
    'profile.loginAlertsSaving': 'Speichere Anmeldebenachrichtigungen...',
    'profile.loginAlertsUpdated': 'Anmeldebenachrichtigungen aktualisiert',
    'profile.activeSessions': 'Aktive Sitzungen',
    'profile.activeSessionsDescription': 'Geräte, die derzeit in deinem Konto angemeldet sind.',
    'profile.activeSessionsUpdated': 'Aus Live-Sitzungsdaten aktualisiert',
    'profile.preferences': 'Einstellungen',
    'profile.notificationPreferences': 'Benachrichtigungseinstellungen',
    'profile.languageRegion': 'Sprache & Region',
    'profile.languageLabel': 'Sprache',
    'profile.regionLabel': 'Region',
    'profile.languageUpdated': 'Sprache aktualisiert',
    'profile.regionUpdated': 'Region aktualisiert',
    'profile.resourceUsage': 'Ressourcennutzung',
    'profile.sshKeys': 'SSH-Schlüssel',
    'profile.noSshKeysFound': 'Keine SSH-Schlüssel gefunden. Füge einen hinzu, um zu beginnen.',
    'profile.noSshKeysFoundCreate': 'Keine SSH-Schlüssel gefunden. Erstelle einen, um zu beginnen.',
    'profile.addedOn': 'Hinzugefügt am',
    'profile.created': 'Erstellt',
    'profile.expires': 'Läuft ab',
    'profile.currentSession': 'Aktuelle Sitzung',
    'profile.unknownDevice': 'Unbekanntes Gerät',
    'profile.unknownBrowser': 'Unbekannter Browser',
    'profile.unknownOS': 'Unbekanntes Betriebssystem',
    'profile.unknownLocation': 'Unbekannter Standort',
    'profile.currentDevice': 'Aktuelles Gerät',
    'profile.delete': 'Löschen',
    'profile.deleteKey': 'Schlüssel löschen',
    'profile.revoke': 'Widerrufen',
    'profile.noActiveSessions': 'Zurzeit keine aktiven Sitzungen.',
    'profile.noActiveSessionsDescription': 'Wenn du dich auf einem Gerät anmeldest, wird es hier mit Live-Sitzungsdetails angezeigt.',
    'profile.sshKeyAdded': 'SSH-Schlüssel erfolgreich hinzugefügt',
    'profile.sshKeyDeleted': 'SSH-Schlüssel gelöscht',
    'profile.editModeEnabled': 'Bearbeitungsmodus aktiviert. Nimm deine Änderungen vor und klicke auf Speichern.',
    'profile.nameAndEmailRequired': 'Name und E-Mail sind erforderlich',
    'profile.validEmailRequired': 'Gib eine gültige E-Mail-Adresse ein',
    'profile.failedToUpdateProfile': 'Profil konnte nicht aktualisiert werden',
    'profile.errorUpdatingProfile': 'Fehler beim Aktualisieren des Profils',
    'profile.profileUpdated': 'Profil erfolgreich aktualisiert!',
    'profile.changesCancelled': 'Änderungen abgebrochen',
    'profile.passwordFieldsRequired': 'Bitte alle Felder ausfüllen',
    'profile.passwordsDoNotMatch': 'Die neuen Passwörter stimmen nicht überein',
    'profile.passwordMinLength': 'Das Passwort muss mindestens 8 Zeichen lang sein',
    'profile.passwordChanged': 'Passwort erfolgreich geändert!',
    'profile.errorChangingPassword': 'Fehler beim Ändern des Passworts',
    'profile.signInToUpdateLoginAlerts': 'Bitte melde dich an, um Anmeldebenachrichtigungen zu aktualisieren',
    'profile.unableToLoadLoginAlerts': 'Anmeldebenachrichtigungseinstellungen konnten nicht geladen werden',
    'profile.unableToSaveLoginAlerts': 'Anmeldebenachrichtigungseinstellungen konnten nicht gespeichert werden',
    'profile.loginAlertsLoaded': 'Die Einstellungen für Anmeldebenachrichtigungen sind in deinem Konto gespeichert.',
    'profile.loginAlertsSavedMessage': 'Anmeldebenachrichtigungseinstellungen gespeichert.',
    'profile.loginAlertsUpdateMessage': 'Anmeldebenachrichtigungen aktualisiert',
    'profile.twoFAEnabledMessage': '2FA wurde aktiviert',
    'profile.twoFADisabledMessage': '2FA wurde deaktiviert',
    'profile.twoFAEnabledStatus': '2FA ist aktiviert',
    'profile.twoFADisabledStatus': '2FA ist nicht aktiviert',
    'profile.createdLabel': 'Erstellt',
    'profile.expiresLabel': 'Läuft ab',
    'profile.currentLabel': 'Aktuell',
    'profile.revokeLabel': 'Widerrufen',
    'profile.selectLanguage': 'Sprache',
    'profile.selectRegion': 'Region',
    'language.englishUS': 'Englisch (USA)',
    'language.englishUK': 'Englisch (Vereinigtes Königreich)',
    'language.spanish': 'Spanisch',
    'language.french': 'Französisch',
    'language.german': 'Deutsch',
    'region.unitedStates': 'Vereinigte Staaten',
    'region.unitedKingdom': 'Vereinigtes Königreich',
    'region.india': 'Indien',
    'region.germany': 'Deutschland'
};
const I18N = {
    'en-US': EN_US_STRINGS,
    'en-GB': EN_US_STRINGS,
    'es-ES': ES_STRINGS,
    'fr-FR': FR_STRINGS,
    'de-DE': DE_STRINGS
};
let marketingRevealObserver = null;
let pendingMarketingSectionId = null;

let currentLocale = DEFAULT_LOCALE;
let currentRegion = DEFAULT_REGION;

function getStoredProfile() {
    try {
        return JSON.parse(localStorage.getItem('bytesky_profile') || '{}') || {};
    } catch (error) {
        return {};
    }
}

function updateStoredProfile(updates = {}) {
    const nextProfile = {
        ...getStoredProfile(),
        ...updates
    };
    localStorage.setItem('bytesky_profile', JSON.stringify(nextProfile));
    return nextProfile;
}

function normalizeLocale(locale) {
    const value = String(locale || '').trim();
    if (!value) return DEFAULT_LOCALE;

    const lower = value.toLowerCase();
    if (I18N[value]) return value;
    if (lower.startsWith('en')) return lower.includes('gb') ? 'en-GB' : 'en-US';
    if (lower.startsWith('es')) return 'es-ES';
    if (lower.startsWith('fr')) return 'fr-FR';
    if (lower.startsWith('de')) return 'de-DE';

    switch (lower) {
        case 'english (us)':
            return 'en-US';
        case 'english (uk)':
            return 'en-GB';
        case 'spanish':
            return 'es-ES';
        case 'french':
            return 'fr-FR';
        case 'german':
            return 'de-DE';
        default:
            return DEFAULT_LOCALE;
    }
}

function normalizeRegion(region) {
    const value = String(region || '').trim().toLowerCase();
    if (!value) return DEFAULT_REGION;

    switch (value) {
        case 'us':
        case 'united states':
            return 'us';
        case 'gb':
        case 'uk':
        case 'united kingdom':
            return 'gb';
        case 'in':
        case 'india':
            return 'in';
        case 'de':
        case 'germany':
            return 'de';
        default:
            return DEFAULT_REGION;
    }
}

function getSavedLanguagePreference() {
    const storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (storedLanguage) {
        return normalizeLocale(storedLanguage);
    }

    const savedProfile = getStoredProfile();
    if (savedProfile.language) {
        return normalizeLocale(savedProfile.language);
    }

    return normalizeLocale(window.navigator?.language || DEFAULT_LOCALE);
}

function getSavedRegionPreference() {
    const storedRegion = localStorage.getItem(REGION_STORAGE_KEY);
    if (storedRegion) {
        return normalizeRegion(storedRegion);
    }

    const savedProfile = getStoredProfile();
    if (savedProfile.region) {
        return normalizeRegion(savedProfile.region);
    }

    return DEFAULT_REGION;
}

function getLocaleDictionary(locale = currentLocale) {
    const normalizedLocale = normalizeLocale(locale);
    return I18N[normalizedLocale] || EN_US_STRINGS;
}

function translate(key, params = {}, locale = currentLocale) {
    const dictionary = getLocaleDictionary(locale);
    const template = dictionary[key] || EN_US_STRINGS[key] || key;

    return template.replace(/\{(\w+)\}/g, (_, token) => (
        Object.prototype.hasOwnProperty.call(params, token) ? String(params[token]) : ''
    ));
}

function formatLocalizedDate(value, options = {}, fallback = translate('general.unknownTime')) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return fallback;
    }

    return new Intl.DateTimeFormat(getActiveLocale(), options).format(date);
}

function formatLocalizedDateShort(value, fallback = translate('general.unknown')) {
    return formatLocalizedDate(value, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    }, fallback);
}

function formatLocalizedMonthYear(value, fallback = translate('general.unknown')) {
    return formatLocalizedDate(value, {
        month: 'short',
        year: 'numeric'
    }, fallback);
}

function formatLocalizedDateTime(value, fallback = translate('general.unknown')) {
    return formatLocalizedDate(value, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }, fallback);
}

function formatStoredDate(value, options = {}, fallback = translate('general.unknown')) {
    if (!value) {
        return fallback;
    }

    if (value instanceof Date || typeof value === 'number') {
        return formatLocalizedDate(value, options, fallback);
    }

    if (typeof value === 'string') {
        if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(value)) {
            return formatLocalizedDate(value, options, fallback);
        }

        return value;
    }

    return formatLocalizedDate(value, options, fallback);
}

function getActiveLocale() {
    return currentLocale || getSavedLanguagePreference();
}

function syncLanguageControls() {
    const languageSelect = document.getElementById('profile-language');
    if (languageSelect && languageSelect.value !== currentLocale) {
        languageSelect.value = currentLocale;
    }

    const regionSelect = document.getElementById('profile-region');
    if (regionSelect && regionSelect.value !== currentRegion) {
        regionSelect.value = currentRegion;
    }
}

function applyLocalizedText(root = document) {
    const scope = root || document;

    scope.querySelectorAll('[data-i18n]').forEach((element) => {
        const key = element.getAttribute('data-i18n');
        if (!key) return;
        element.textContent = translate(key);
    });

    scope.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
        const key = element.getAttribute('data-i18n-placeholder');
        if (!key) return;
        element.setAttribute('placeholder', translate(key));
    });

    scope.querySelectorAll('[data-i18n-title]').forEach((element) => {
        const key = element.getAttribute('data-i18n-title');
        if (!key) return;
        element.setAttribute('title', translate(key));
    });

    scope.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
        const key = element.getAttribute('data-i18n-aria-label');
        if (!key) return;
        element.setAttribute('aria-label', translate(key));
    });
}

function updateProfileTwoFactorStatus() {
    const toggle = document.getElementById('2fa-toggle');
    const status = document.getElementById('2fa-status');
    if (!toggle || !status) return;

    if (toggle.checked) {
        status.innerHTML = `<span style="color: #166534;">${translate('profile.twoFactorCurrently')} <strong>${translate('profile.twoFactorEnabledState')}</strong></span>`;
        status.style.background = '#f0fdf4';
        status.style.borderLeftColor = '#10b981';
    } else {
        status.innerHTML = `<span style="color: #991b1b;">${translate('profile.twoFactorCurrently')} <strong>${translate('profile.twoFactorDisabledState')}</strong></span>`;
        status.style.background = '#fee2e2';
        status.style.borderLeftColor = '#ef4444';
    }
}

function syncProfilePreferencesTexts() {
    syncLanguageControls();
    updateProfileTwoFactorStatus();
}

function applyLanguagePreference(locale = getSavedLanguagePreference(), options = {}) {
    const { persist = false, region = getSavedRegionPreference() } = options;
    const nextLocale = normalizeLocale(locale);
    const nextRegion = normalizeRegion(region);

    currentLocale = nextLocale;
    currentRegion = nextRegion;

    if (persist) {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLocale);
        localStorage.setItem(REGION_STORAGE_KEY, nextRegion);
        updateStoredProfile({
            language: nextLocale,
            region: nextRegion
        });
    }

    document.documentElement.lang = nextLocale;
    document.documentElement.dir = 'ltr';
    if (document.body) {
        document.body.dataset.language = nextLocale;
        document.body.dataset.region = nextRegion;
    }

    applyLocalizedText(document);
    syncProfilePreferencesTexts();

    if (getActivePageId() === 'profile' && currentUser) {
        loadProfileData();
    }
}

function getMainContentElement() {
    return document.querySelector('.main-content');
}

function getActivePageId() {
    return document.querySelector('.page.active')?.id || null;
}

function updateNavScrollState() {
    const nav = document.querySelector('nav');
    const mainContent = getMainContentElement();
    const activePageId = getActivePageId();
    if (!nav || !mainContent) return;

    const shouldElevate = Boolean(currentUser) || activePageId !== 'home' || mainContent.scrollTop > 12;
    nav.classList.toggle('nav-scrolled', shouldElevate);
}

function disconnectMarketingReveal() {
    if (marketingRevealObserver) {
        marketingRevealObserver.disconnect();
        marketingRevealObserver = null;
    }
}

function initializeMarketingReveal() {
    const homePage = document.getElementById('home');
    const mainContent = getMainContentElement();
    if (!homePage || !homePage.classList.contains('active') || currentUser || !mainContent) {
        disconnectMarketingReveal();
        return;
    }

    const revealItems = Array.from(homePage.querySelectorAll('.reveal'));
    if (!revealItems.length) {
        disconnectMarketingReveal();
        return;
    }

    if (typeof IntersectionObserver !== 'function') {
        revealItems.forEach((item) => item.classList.add('is-visible'));
        return;
    }

    disconnectMarketingReveal();

    marketingRevealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                marketingRevealObserver?.unobserve(entry.target);
            }
        });
    }, {
        root: mainContent,
        threshold: 0.14,
        rootMargin: '0px 0px -10% 0px'
    });

    revealItems.forEach((item, index) => {
        if (index < 2) {
            item.classList.add('is-visible');
            return;
        }

        item.classList.remove('is-visible');
        marketingRevealObserver.observe(item);
    });
}

function scrollMarketingSectionIntoView(sectionId) {
    if (!MARKETING_SECTION_IDS.has(sectionId)) {
        return;
    }

    const mainContent = getMainContentElement();
    const target = document.getElementById(sectionId);
    if (!mainContent || !target) {
        return;
    }

    const mainBounds = mainContent.getBoundingClientRect();
    const targetBounds = target.getBoundingClientRect();
    const targetTop = targetBounds.top - mainBounds.top + mainContent.scrollTop - 92;

    mainContent.scrollTo({
        top: Math.max(targetTop, 0),
        behavior: 'smooth'
    });
}

function navigateToMarketingSection(sectionId) {
    if (!MARKETING_SECTION_IDS.has(sectionId)) {
        return;
    }

    if (!currentUser && getActivePageId() === 'home') {
        scrollMarketingSectionIntoView(sectionId);
        return;
    }

    pendingMarketingSectionId = sectionId;
    router('home', { skipAuthCheck: true });
}

function isCompactSidebarLayout() {
    return window.innerWidth <= SIDEBAR_DISMISS_BREAKPOINT;
}

function getSavedSidebarCollapsed() {
    return localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY) === 'true';
}

function setSidebarCollapsed(isCollapsed) {
    document.body.classList.toggle('sidebar-collapsed', Boolean(currentUser) && Boolean(isCollapsed) && !isCompactSidebarLayout());
}

function setSidebarOpen(isOpen) {
    const sidebar = document.getElementById('sidebar');

    if (!sidebar) {
        return;
    }

    const nextState = Boolean(isOpen && currentUser && isCompactSidebarLayout());
    sidebar.classList.toggle('active', nextState);
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');

    if (!currentUser || !sidebar) {
        return;
    }

    if (isCompactSidebarLayout()) {
        setSidebarOpen(!sidebar.classList.contains('active'));
        return;
    }

    const nextCollapsed = !document.body.classList.contains('sidebar-collapsed');
    localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, String(nextCollapsed));
    setSidebarCollapsed(nextCollapsed);

}

function handleSidebarDismiss(event) {
    const sidebar = document.getElementById('sidebar');

    if (!sidebar || !sidebar.classList.contains('active') || !isCompactSidebarLayout()) {
        return;
    }

    const clickedInsideSidebar = sidebar.contains(event.target);

    if (!clickedInsideSidebar) {
        setSidebarOpen(false);
    }
}

function syncSidebarLayout() {
    if (!currentUser) {
        return;
    }

    if (isCompactSidebarLayout()) {
        setSidebarCollapsed(false);
        setSidebarOpen(false);
    } else {
        setSidebarOpen(false);
        setSidebarCollapsed(getSavedSidebarCollapsed());
    }

    updateNav();
}

function showToast(message) {
    const x = document.getElementById("toast");
    if (x) {
        x.innerText = message;
        x.className = "show";
        setTimeout(() => { x.className = x.className.replace("show", ""); }, 3000);
    } else {
        alert(message);
    }
}

function getSavedThemePreference() {
    return localStorage.getItem(THEME_STORAGE_KEY) || 'light';
}

function resolveTheme(themePreference = getSavedThemePreference()) {
    if (themePreference === 'system') {
        return SYSTEM_THEME_QUERY?.matches ? 'dark' : 'light';
    }

    return themePreference === 'dark' ? 'dark' : 'light';
}

function syncThemeButtons(themePreference = getSavedThemePreference()) {
    document.querySelectorAll('[data-theme-choice]').forEach((button) => {
        const isActive = button.getAttribute('data-theme-choice') === themePreference;
        button.classList.toggle('btn-primary', isActive);
        button.classList.toggle('btn-outline', !isActive);
        button.classList.toggle('theme-choice-active', isActive);
    });
}

function applyTheme(themePreference = getSavedThemePreference(), options = {}) {
    const { persist = false } = options;
    const resolvedTheme = resolveTheme(themePreference);

    if (persist) {
        localStorage.setItem(THEME_STORAGE_KEY, themePreference);
    }

    document.body.dataset.theme = resolvedTheme;
    document.body.dataset.themePreference = themePreference;
    syncThemeButtons(themePreference);
}

function clearStoredSession() {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(LEGACY_AUTH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    localStorage.removeItem(SESSION_ID_STORAGE_KEY);
    token = null;
    currentUser = null;
    currentAuthSessionId = null;
}

function getActiveAuthToken() {
    return token
        || localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
        || localStorage.getItem(LEGACY_AUTH_TOKEN_STORAGE_KEY)
        || null;
}

function getActiveAuthUser() {
    if (currentUser?.email) {
        return currentUser;
    }

    const rawUser = localStorage.getItem(AUTH_USER_STORAGE_KEY);
    if (!rawUser) {
        return null;
    }

    try {
        return JSON.parse(rawUser);
    } catch (_error) {
        return null;
    }
}

function setCurrentAuthSessionId(sessionId) {
    currentAuthSessionId = sessionId || null;

    if (currentAuthSessionId) {
        localStorage.setItem(SESSION_ID_STORAGE_KEY, currentAuthSessionId);
    } else {
        localStorage.removeItem(SESSION_ID_STORAGE_KEY);
    }
}

function hasAuthenticatedSession() {
    return Boolean(getActiveAuthToken() && getActiveAuthUser()?.email);
}

function getUserDisplayName(user = currentUser) {
    const name = String(user?.name || '').trim();
    if (name) {
        return name;
    }

    const email = String(user?.email || '').trim();
    if (email) {
        return email.split('@')[0];
    }

    return 'Signed in';
}

function getUserGreetingName(user = currentUser) {
    const displayName = getUserDisplayName(user);
    return displayName.split(/\s+/)[0] || displayName;
}

function parseJwtPayload(tokenValue) {
    if (!tokenValue || !tokenValue.includes('.')) {
        return null;
    }

    try {
        const [, payload] = tokenValue.split('.');
        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
        const decoded = atob(padded);
        return JSON.parse(decoded);
    } catch (_error) {
        return null;
    }
}

function isStoredTokenUsable(tokenValue) {
    const payload = parseJwtPayload(tokenValue);
    if (!payload) {
        return false;
    }

    if (!payload.exp) {
        return true;
    }

    return (payload.exp * 1000) > (Date.now() + 5000);
}

function resolveSessionIdFromAuthResponse(data = {}) {
    return data?.session?.sessionId
        || data?.sessionId
        || parseJwtPayload(data?.token || '')?.jti
        || currentAuthSessionId
        || null;
}

async function resolveCurrentSessionIdForLogout() {
    const storedSessionId = currentAuthSessionId || localStorage.getItem(SESSION_ID_STORAGE_KEY);
    if (storedSessionId) {
        return storedSessionId;
    }

    const tokenPayload = parseJwtPayload(token || '');
    if (tokenPayload?.jti) {
        return tokenPayload.jti;
    }

    if (!token || !window.crypto?.subtle || typeof TextEncoder !== 'function') {
        return null;
    }

    const tokenBuffer = new TextEncoder().encode(token);
    const digest = await window.crypto.subtle.digest('SHA-256', tokenBuffer);
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

function createFallbackDeviceId() {
    return `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function getOrCreateDeviceId() {
    let deviceId = localStorage.getItem(DEVICE_ID_STORAGE_KEY);

    if (!deviceId) {
        deviceId = window.crypto?.randomUUID?.() || createFallbackDeviceId();
        localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
    }

    return deviceId;
}

function getDeviceHeaders() {
    return {
        'X-ByteSky-Device-Id': getOrCreateDeviceId()
    };
}

async function fetchClientConfig() {
    if (!clientConfigPromise) {
        clientConfigPromise = fetch(`${API_URL}/health/client-config`)
            .then(res => res.ok ? res.json() : {})
            .catch(() => ({}))
            .then((data) => ({
                appBaseUrl: data.appBaseUrl || '',
                corsOrigins: Array.isArray(data.corsOrigins) ? data.corsOrigins : [],
                googleClientId: typeof data.googleClientId === 'string' ? data.googleClientId.trim() : '',
                googleAuthEnabled: typeof data.googleAuthEnabled === 'boolean'
                    ? data.googleAuthEnabled
                    : Boolean(typeof data.googleClientId === 'string' && data.googleClientId.trim())
            }));
    }

    return clientConfigPromise;
}

function normalizeOrigin(url) {
    if (!url) {
        return '';
    }

    try {
        return new URL(url).origin;
    } catch (_error) {
        return '';
    }
}

function isLocalAliasHost(hostname) {
    return hostname === 'localhost' || hostname === '127.0.0.1';
}

function renderGoogleAuthMessage(message) {
    ['googleLoginButton', 'googleRegisterButton'].forEach((id) => {
        const container = document.getElementById(id);
        if (!container) return;

        container.innerHTML = `
            <div style="font-size:0.85rem; color:#64748b; text-align:center; line-height:1.5;">
                ${message}
            </div>
        `;
    });
}

async function isGoogleAuthAllowedOnCurrentOrigin() {
    const config = await fetchClientConfig();
    const currentOrigin = window.location.origin;
    const preferredOrigin = normalizeOrigin(config.appBaseUrl);

    if (!config.googleAuthEnabled || !config.googleClientId) {
        return {
            allowed: false,
            reason: 'Google sign-in is not configured for this environment.'
        };
    }

    if (preferredOrigin && currentOrigin !== preferredOrigin) {
        return {
            allowed: false,
            reason: `Google sign-in is available on ${preferredOrigin}. Open the app there instead of ${currentOrigin}.`
        };
    }

    if (!preferredOrigin && window.location.hostname === '127.0.0.1') {
        return {
            allowed: false,
            reason: 'For local Google sign-in, open the app with localhost instead of 127.0.0.1.'
        };
    }

    return {
        allowed: true,
        clientId: config.googleClientId
    };
}

async function alignLocalOriginWithConfig() {
    if (!window.location.protocol.startsWith('http')) {
        return false;
    }

    const config = await fetchClientConfig();
    const preferredOrigin = normalizeOrigin(config.appBaseUrl);
    if (!preferredOrigin) {
        return false;
    }

    const currentUrl = new URL(window.location.href);
    const preferredUrl = new URL(preferredOrigin);
    const sameLocalAliasFamily = isLocalAliasHost(currentUrl.hostname) && isLocalAliasHost(preferredUrl.hostname);
    if (!sameLocalAliasFamily) {
        return false;
    }

    if (currentUrl.origin === preferredUrl.origin) {
        return false;
    }

    const redirectUrl = `${preferredUrl.origin}${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
    window.location.replace(redirectUrl);
    return true;
}

function applyAuthenticatedSession(data, successMessage) {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, data.token);
    localStorage.setItem(LEGACY_AUTH_TOKEN_STORAGE_KEY, data.token);
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(data.user));
    token = data.token;
    currentUser = data.user;
    setCurrentAuthSessionId(resolveSessionIdFromAuthResponse(data));
    updateNav();
    if (successMessage) {
        showToast(successMessage);
    }
    router('dashboard');
}
// ============================================
// AUTHENTICATION
// ============================================

async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('regName')?.value;
    const email = document.getElementById('regEmail')?.value;
    const password = document.getElementById('regPass')?.value;

    if (!name || !email || !password) {
        showToast('Please fill all fields');
        return;
    }

    const btn = e.target.querySelector('button');
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'Creating...';
    }

    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getDeviceHeaders() },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();

        if (res.ok) {
            applyAuthenticatedSession(data, 'Registration successful!');
        } else {
            showToast(data.msg || 'Registration failed');
        }
    } catch (err) {
        console.error('Register Error:', err);
        showToast('Cannot connect to server. Make sure backend is running!');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = 'Create Account';
        }
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail')?.value;
    const password = document.getElementById('loginPass')?.value;

    if (!email || !password) {
        showToast('Please fill all fields');
        return;
    }

    const btn = e.target.querySelector('button');
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'Signing in...';
    }

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getDeviceHeaders() },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (res.ok) {
            applyAuthenticatedSession(data, 'Login successful!');
        } else {
            showToast(data.msg || 'Invalid Credentials');
        }
    } catch (err) {
        console.error('Login Error:', err);
        showToast('Cannot connect to server. Make sure backend is running!');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = 'Sign In';
        }
    }
}

async function logout() {
    const sessionId = await resolveCurrentSessionIdForLogout();

    try {
        if (token && sessionId) {
            await fetch(`${API_URL}/auth/sessions/current`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        }
    } catch (error) {
        console.warn('Logout session revoke failed:', error);
    } finally {
        clearStoredSession();
        updateNav();
        router('home', { skipAuthCheck: true });
    }
}

async function checkSession() {
    const storedToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || localStorage.getItem(LEGACY_AUTH_TOKEN_STORAGE_KEY);
    const storedUser = localStorage.getItem(AUTH_USER_STORAGE_KEY);

    if (!storedToken || !storedUser) {
        clearStoredSession();
        updateNav();
        router('home', { skipAuthCheck: true });
        return false;
    }

    if (!isStoredTokenUsable(storedToken)) {
        clearStoredSession();
        updateNav();
        showToast('Your session expired. Please sign in again.');
        router('login', { skipAuthCheck: true });
        return false;
    }

    try {
        if (!localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) && storedToken) {
            localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, storedToken);
        }
        currentUser = JSON.parse(storedUser);
        token = storedToken;
    } catch (err) {
        console.error('Session parse error:', err);
        clearStoredSession();
        updateNav();
        router('home', { skipAuthCheck: true });
        return false;
    }

    try {
        const res = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            throw new Error(`Session check failed with status ${res.status}`);
        }

        const data = await res.json().catch(() => ({}));
        if (data.user) {
            currentUser = data.user;
            localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(currentUser));
        }

        const resolvedSessionId = resolveSessionIdFromAuthResponse(data);
        if (resolvedSessionId) {
            setCurrentAuthSessionId(resolvedSessionId);
        }

        updateNav();
        router('dashboard');
        return true;
    } catch (_error) {
        clearStoredSession();
        updateNav();
        showToast('Please sign in again.');
        router('login', { skipAuthCheck: true });
        return false;
    }
}

// ============================================
// NAVIGATION (ADDED - This was missing!)
// ============================================

function updateNav() {
    const nav = document.getElementById('navLinks');
    const adminLink = document.getElementById('adminLink');

    if (currentUser) {
        nav.className = 'nav-links nav-links-private';
        nav.innerHTML = `
            <span class="nav-welcome">Welcome, ${escapeHtml(getUserGreetingName(currentUser))}</span>
            <button class="btn-logout" onclick="logout()">Logout</button>
        `;
        document.body.classList.add('sidebar-visible');
        const collapsed = getSavedSidebarCollapsed();
        setSidebarCollapsed(collapsed);
        setSidebarOpen(false);
        if (adminLink) {
            adminLink.style.display = currentUser.role === 'admin' ? 'flex' : 'none';
        }
    } else {
        document.body.classList.remove('sidebar-visible', 'sidebar-collapsed');
        nav.className = 'nav-links nav-links-hidden';
        nav.innerHTML = '';
        setSidebarOpen(false);
        if (adminLink) adminLink.style.display = 'none';
    }

    updateNavScrollState();
}

// ============================================
// PROFILE PAGE FUNCTIONS
// ============================================

function showProfileTab(tabName, clickedBtn) {
    document.querySelectorAll('.profile-tab').forEach(tab => {
        tab.style.display = 'none';
    });

    const selectedTab = document.getElementById(`profile-${tabName}`);
    if (selectedTab) selectedTab.style.display = 'block';

    document.querySelectorAll('.profile-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    if (clickedBtn) {
        clickedBtn.classList.add('active');
    } else {
        const navBtn = document.querySelector(`.profile-tab-btn[onclick*="'${tabName}'"]`);
        if (navBtn) navBtn.classList.add('active');
    }

    if (tabName === 'security') {
        loadAuthSessions();
    }
}
function editProfile() {
    const inputs = document.querySelectorAll('#profile-personal input');
    inputs.forEach(input => {
        input.style.background = 'white';
        input.removeAttribute('readonly');
    });
    showToast(translate('profile.editModeEnabled'));
}

async function saveProfile() {
    const fullName = document.getElementById('profile-fullname')?.value?.trim();
    const email = document.getElementById('profile-email-input')?.value?.trim();
    const phone = document.getElementById('profile-phone').value;
    const job = document.getElementById('profile-job').value;
    const company = document.getElementById('profile-company').value;
    const timezone = document.getElementById('profile-timezone').value;
    const language = document.getElementById('profile-language')?.value || currentLocale;
    const region = document.getElementById('profile-region')?.value || currentRegion;

    if (!fullName || !email) {
        showToast(translate('profile.nameAndEmailRequired'));
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast(translate('profile.validEmailRequired'));
        return;
    }

    // Save to localStorage or send to backend
    const profileData = {
        phone,
        job,
        company,
        timezone,
        language: normalizeLocale(language),
        region: normalizeRegion(region)
    };

    try {
        const res = await fetch(`${API_URL}/auth/profile`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name: fullName, email })
        });

        const data = await res.json();
        if (!res.ok) {
            showToast(data.msg || translate('profile.failedToUpdateProfile'));
            return;
        }

        currentUser = data.user;
        localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(currentUser));
        localStorage.setItem('bytesky_profile', JSON.stringify(profileData));
        localStorage.setItem(LANGUAGE_STORAGE_KEY, profileData.language);
        localStorage.setItem(REGION_STORAGE_KEY, profileData.region);

        updateNav();
        loadProfileData();
    } catch (err) {
        showToast(translate('profile.errorUpdatingProfile'));
        return;
    }

    // Make inputs readonly again
    const inputs = document.querySelectorAll('#profile-personal input');
    inputs.forEach(input => {
        input.style.background = '#f8fafc';
        input.setAttribute('readonly', 'readonly');
    });

    showToast(translate('profile.profileUpdated'));
}

function cancelEdit() {
    const inputs = document.querySelectorAll('#profile-personal input');
    inputs.forEach(input => {
        input.style.background = '#f8fafc';
        input.setAttribute('readonly', 'readonly');
    });
    showToast(translate('profile.changesCancelled'));
}

function handleProfileLanguageChange(locale) {
    const nextRegion = currentRegion || getSavedRegionPreference();
    applyLanguagePreference(locale, { persist: true, region: nextRegion });
    showToast(translate('profile.languageUpdated'));
}

function handleProfileRegionChange(region) {
    const nextLocale = currentLocale || getSavedLanguagePreference();
    applyLanguagePreference(nextLocale, { persist: true, region });
    showToast(translate('profile.regionUpdated'));
}

async function changePassword() {
    const current = document.getElementById('current-password').value;
    const newPass = document.getElementById('new-password').value;
    const confirm = document.getElementById('confirm-password').value;

    if (!current || !newPass || !confirm) {
        showToast(translate('profile.passwordFieldsRequired'));
        return;
    }

    if (newPass !== confirm) {
        showToast(translate('profile.passwordsDoNotMatch'));
        return;
    }

    if (newPass.length < 8) {
        showToast(translate('profile.passwordMinLength'));
        return;
    }

    try {
        const res = await fetch(`${API_URL}/auth/password`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                currentPassword: current,
                newPassword: newPass
            })
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            showToast(data.msg || data.message || translate('profile.errorChangingPassword'));
            return;
        }

        showToast(translate('profile.passwordChanged'));
        document.getElementById('current-password').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-password').value = '';
    } catch (err) {
        showToast(translate('profile.errorChangingPassword'));
    }
}

function getDefaultLoginAlertPreferences() {
    return {
        emailOnNewDevice: true,
        emailOnFailedLogin: false
    };
}

function setLoginAlertStatus(message, isError = false) {
    const status = document.getElementById('login-alert-status');
    if (!status) return;

    status.innerText = message;
    status.style.color = isError ? '#991b1b' : '#64748b';
}

function setLoginAlertControlsDisabled(disabled) {
    ['login-alert-new-device', 'login-alert-failed-login'].forEach((id) => {
        const checkbox = document.getElementById(id);
        if (checkbox) checkbox.disabled = disabled;
    });
}

function applyLoginAlertPreferences(preferences = {}) {
    const mergedPreferences = {
        ...getDefaultLoginAlertPreferences(),
        ...preferences
    };
    const newDeviceInput = document.getElementById('login-alert-new-device');
    const failedLoginInput = document.getElementById('login-alert-failed-login');

    if (newDeviceInput) {
        newDeviceInput.checked = mergedPreferences.emailOnNewDevice !== false;
    }

    if (failedLoginInput) {
        failedLoginInput.checked = mergedPreferences.emailOnFailedLogin === true;
    }
}

async function loadLoginAlertPreferences() {
    if (!token) return;

    applyLoginAlertPreferences(currentUser?.loginAlerts);

    try {
        const res = await fetch(`${API_URL}/auth/login-alerts`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.message || data.msg || translate('profile.unableToLoadLoginAlerts'));
        }

        currentUser = {
            ...currentUser,
            loginAlerts: data.loginAlerts
        };
        localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(currentUser));
        applyLoginAlertPreferences(data.loginAlerts);
        setLoginAlertStatus(translate('profile.loginAlertsLoaded'));
    } catch (err) {
        setLoginAlertStatus(err.message || translate('profile.unableToLoadLoginAlerts'), true);
    }
}

async function saveLoginAlertPreferences() {
    if (!token) {
        showToast(translate('profile.signInToUpdateLoginAlerts'));
        return;
    }

    const payload = {
        emailOnNewDevice: document.getElementById('login-alert-new-device')?.checked === true,
        emailOnFailedLogin: document.getElementById('login-alert-failed-login')?.checked === true
    };

    setLoginAlertControlsDisabled(true);
    setLoginAlertStatus(translate('profile.loginAlertsSaving'));

    try {
        const res = await fetch(`${API_URL}/auth/login-alerts`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.message || data.msg || translate('profile.unableToSaveLoginAlerts'));
        }

        currentUser = data.user || {
            ...currentUser,
            loginAlerts: data.loginAlerts
        };
        localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(currentUser));
        applyLoginAlertPreferences(data.loginAlerts || currentUser.loginAlerts);
        setLoginAlertStatus(translate('profile.loginAlertsSavedMessage'));
        showToast(translate('profile.loginAlertsUpdateMessage'));
    } catch (err) {
        applyLoginAlertPreferences(currentUser?.loginAlerts);
        setLoginAlertStatus(err.message || translate('profile.unableToSaveLoginAlerts'), true);
        showToast(err.message || translate('profile.unableToSaveLoginAlerts'));
    } finally {
        setLoginAlertControlsDisabled(false);
    }
}

function toggle2FA() {
    const toggle = document.getElementById('2fa-toggle');
    const status = document.getElementById('2fa-status');

    if (toggle.checked) {
        status.innerHTML = `<span style="color: #166534;">${translate('profile.twoFactorCurrently')} <strong>${translate('profile.twoFactorEnabledState')}</strong></span>`;
        status.style.background = '#f0fdf4';
        status.style.borderLeftColor = '#10b981';
        showToast(translate('profile.twoFAEnabledMessage'));
    } else {
        status.innerHTML = `<span style="color: #991b1b;">${translate('profile.twoFactorCurrently')} <strong>${translate('profile.twoFactorDisabledState')}</strong></span>`;
        status.style.background = '#fee2e2';
        status.style.borderLeftColor = '#ef4444';
        showToast(translate('profile.twoFADisabledMessage'));
    }
}

function formatRelativeTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return translate('general.unknownTime');
    }

    const diffMs = date.getTime() - Date.now();
    const diffAbs = Math.abs(diffMs);

    if (diffAbs < 30 * 1000) {
        return translate('general.justNow');
    }

    const units = [
        { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
        { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
        { unit: 'day', ms: 24 * 60 * 60 * 1000 },
        { unit: 'hour', ms: 60 * 60 * 1000 },
        { unit: 'minute', ms: 60 * 1000 }
    ];
    const formatter = new Intl.RelativeTimeFormat(getActiveLocale(), { numeric: 'auto' });

    for (const unit of units) {
        if (diffAbs >= unit.ms) {
            const valueCount = Math.max(1, Math.round(diffAbs / unit.ms));
            return formatter.format(diffMs < 0 ? -valueCount : valueCount, unit.unit);
        }
    }

    return diffMs > 0 ? translate('general.inMoment') : translate('general.justNow');
}

function formatSessionDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return translate('general.unknown');
    }

    return formatLocalizedDateTime(date);
}

function renderAuthSessions(sessions = []) {
    const container = document.getElementById('active-sessions-list');
    if (!container) {
        return;
    }

    authSessions = Array.isArray(sessions) ? sessions : [];

    if (!authSessions.length) {
        container.innerHTML = `
            <div class="profile-session-empty">
                <strong>No active sessions right now.</strong>
                <div style="margin-top: 6px;">When you sign in on a device, it will appear here with live session details.</div>
            </div>
        `;
        return;
    }

    container.innerHTML = authSessions.map((session) => {
        const title = escapeHtml(session.deviceLabel || 'Unknown device');
        const browser = escapeHtml(session.browser || 'Unknown browser');
        const os = escapeHtml(session.os || 'Unknown OS');
        const location = escapeHtml(session.locationLabel || 'Unknown location');
        const ipAddress = session.ipAddress ? `IP ${escapeHtml(session.ipAddress)}` : '';
        const createdAt = formatSessionDate(session.createdAt);
        const expiresAt = formatSessionDate(session.expiresAt);
        const lastActive = formatRelativeTime(session.lastActiveAt);
        const isCurrent = Boolean(session.isCurrent || session.sessionId === currentAuthSessionId);

        return `
            <div class="profile-session-card" data-session-card="${escapeHtml(session.sessionId)}">
                <div class="profile-session-header">
                    <div class="profile-session-copy">
                        <div class="profile-session-title">${title}</div>
                        <div class="profile-session-meta">
                            ${location}${ipAddress ? ` · ${ipAddress}` : ''} · Last active: ${escapeHtml(lastActive)}
                        </div>
                        <div class="profile-session-chip-row">
                            <span class="profile-session-chip">${browser}</span>
                            <span class="profile-session-chip profile-session-chip--muted">${os}</span>
                        </div>
                    </div>
                    <div class="profile-session-actions">
                        ${isCurrent
                            ? '<span class="profile-session-badge profile-session-badge-current">Current</span>'
                            : `<button class="btn btn-outline profile-session-revoke-btn" type="button" onclick="revokeSession('${escapeHtml(session.sessionId)}')">Revoke</button>`}
                    </div>
                </div>
                <div class="profile-session-footer">
                    <span class="profile-session-chip profile-session-chip--muted">Created ${escapeHtml(createdAt)}</span>
                    <span class="profile-session-chip">Expires ${escapeHtml(expiresAt)}</span>
                </div>
            </div>
        `;
    }).join('');
}

async function loadAuthSessions() {
    const container = document.getElementById('active-sessions-list');
    if (!container || !token) {
        return;
    }

    container.innerHTML = `
        <div class="profile-session-empty">
            <strong>Loading active sessions...</strong>
            <div style="margin-top: 6px;">Fetching signed-in devices from your account.</div>
        </div>
    `;

    try {
        const res = await fetch(`${API_URL}/auth/sessions`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            if (res.status === 401) {
                clearStoredSession();
                updateNav();
                showToast('Your session ended. Please sign in again.');
                router('login', { skipAuthCheck: true });
                return;
            }

            const fallbackMessage = res.status === 404
                ? 'Active sessions endpoint is not available yet. Rebuild the backend container.'
                : res.status >= 500
                    ? 'The server hit an error while loading active sessions.'
                    : 'Unable to load active sessions';
            throw new Error(data.message || data.msg || fallbackMessage);
        }

        if (data.currentSessionId) {
            setCurrentAuthSessionId(data.currentSessionId);
        }

        const currentSession = Array.isArray(data.sessions)
            ? data.sessions.find((session) => session.isCurrent)
            : null;
        if (!currentAuthSessionId && currentSession?.sessionId) {
            setCurrentAuthSessionId(currentSession.sessionId);
        }

        renderAuthSessions(data.sessions || []);
    } catch (error) {
        console.error('Error loading auth sessions:', error);
        container.innerHTML = `
            <div class="profile-session-empty">
                <strong>Unable to load active sessions.</strong>
                <div style="margin-top: 6px;">Please refresh the page or try again in a moment.</div>
            </div>
        `;
    }
}

async function revokeSession(sessionId) {
    if (!sessionId) {
        return;
    }

    const isCurrentSession = sessionId === currentAuthSessionId;
    if (!confirm(isCurrentSession
        ? 'Revoke this session? You will be logged out immediately.'
        : 'Revoke this session? The device will be logged out.')) {
        return;
    }

    try {
        const endpoint = isCurrentSession
            ? `${API_URL}/auth/sessions/current`
            : `${API_URL}/auth/sessions/${encodeURIComponent(sessionId)}`;

        const res = await fetch(endpoint, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            if (res.status === 401) {
                clearStoredSession();
                updateNav();
                showToast('Your session ended. Please sign in again.');
                router('login', { skipAuthCheck: true });
                return;
            }
            throw new Error(data.message || data.msg || 'Unable to revoke session');
        }

        showToast(data.msg || 'Session revoked successfully');

        if (isCurrentSession) {
            clearStoredSession();
            updateNav();
            router('home', { skipAuthCheck: true });
            return;
        }

        await loadAuthSessions();
    } catch (error) {
        console.error('Revoke session error:', error);
        showToast(error.message || 'Unable to revoke session');
    }
}

function setTheme(theme) {
    applyTheme(theme, { persist: true });
    showToast(`${theme.charAt(0).toUpperCase() + theme.slice(1)} mode activated`);
}

let sshKeys = JSON.parse(localStorage.getItem('bytesky_ssh_keys') || '[]');

function getStoredSSHKeys() {
    sshKeys = JSON.parse(localStorage.getItem('bytesky_ssh_keys') || '[]');
    return sshKeys;
}

function persistSSHKeys(keys) {
    sshKeys = keys;
    localStorage.setItem('bytesky_ssh_keys', JSON.stringify(keys));
}

function renderProfileSSHKeys() {
    const list = document.getElementById('ssh-keys-list');
    if (!list) return;

    const keys = getStoredSSHKeys();
    if (keys.length === 0) {
        list.innerHTML = `<p style="color: #64748b; text-align: center; padding: 20px;">${translate('profile.noSshKeysFound')}</p>`;
        return;
    }

    list.innerHTML = keys.map(key => `
        <div class="ssh-key-card">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div>
                    <div style="font-weight: 600;"> ${key.name}</div>
                    <div style="font-size: 0.85rem; color: #64748b; font-family: monospace; margin: 5px 0;">${key.key || key.fingerprint || translate('profile.generatedSshKey')}</div>
                    <div style="font-size: 0.85rem; color: #94a3b8;">${translate('profile.addedOn')} ${formatStoredDate(key.addedAt || key.createdAt || key.added, { month: 'short', day: 'numeric', year: 'numeric' }, key.added || translate('general.unknown'))}</div>
                </div>
                <button class="btn btn-danger" style="font-size: 0.75rem;" onclick="deleteSSHKey('${key.id}')">${translate('profile.delete')}</button>
            </div>
        </div>
    `).join('');
}

function renderComputeSSHKeys() {
    const container = document.getElementById('sshKeysList');
    if (!container) return;

    const keys = getStoredSSHKeys();
    if (keys.length === 0) {
        container.innerHTML = `<p style="color: #64748b; padding: 20px; text-align: center;">${translate('profile.noSshKeysFoundCreate')}</p>`;
        return;
    }

    container.innerHTML = keys.map(key => `
        <div class="ssh-key-item">
            <div class="ssh-key-name"> ${key.name}</div>
            <div class="ssh-key-fingerprint">${key.fingerprint || key.key || translate('profile.manualKeyImport')}</div>
            <div style="margin-top: 10px; font-size: 0.8rem; color: #64748b;">
                ${translate('profile.createdLabel')}: ${key.createdAt ? formatLocalizedDateTime(key.createdAt, translate('general.unknown')) : (key.added || translate('general.justNow'))}
            </div>
            <button class="btn btn-danger" style="margin-top: 10px; font-size: 0.75rem;" onclick="deleteSSHKey('${key.id}')">${translate('profile.deleteKey')}</button>
        </div>
    `).join('');
}

function addSSHKey() {
    const name = prompt('Enter a name for this SSH key (e.g., "my-laptop"):');
    if (!name) return;

    const key = prompt('Paste your SSH public key:');
    if (!key) return;

    const keys = getStoredSSHKeys();
    keys.push({
        id: `key-${Date.now()}`,
        name,
        key: key.substring(0, 50) + '...',
        addedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
    });
    persistSSHKeys(keys);

    showToast(translate('profile.sshKeyAdded'));
    loadSSHKeys();
}

function loadSSHKeys() {
    renderProfileSSHKeys();
    renderComputeSSHKeys();
}

function deleteSSHKey(id) {
    if (!confirm('Delete this SSH key? You may lose access to your instances.')) return;

    const keys = getStoredSSHKeys().filter(k => String(k.id) !== String(id));
    persistSSHKeys(keys);

    showToast(translate('profile.sshKeyDeleted'));
    loadSSHKeys();
}

function deleteAccount() {
    if (!confirm(' WARNING: This action cannot be undone!\n\nAre you sure you want to delete your account? All your data, instances, and resources will be permanently deleted.')) return;

    const confirmText = prompt('Type "DELETE" to confirm account deletion:');
    if (confirmText !== 'DELETE') {
        showToast(translate('profile.accountDeletionCancelled'));
        return;
    }

    // Call backend to delete account
    showToast(translate('profile.accountDeletionInitiated'));
    setTimeout(() => {
        logout();
    }, 2000);
}

// Load profile data on page load
function loadProfileData() {
    if (!currentUser) return;

    // Set basic info
    document.getElementById('profile-name-display').innerText = currentUser.name;
    document.getElementById('profile-email-display').innerText = currentUser.email;
    document.getElementById('profile-role-display').innerText = currentUser.role?.toUpperCase() || 'USER';
    document.getElementById('profile-avatar-large').innerText = currentUser.name.charAt(0).toUpperCase();
    const fullNameInput = document.getElementById('profile-fullname');
    const emailInput = document.getElementById('profile-email-input');
    if (fullNameInput) fullNameInput.value = currentUser.name || '';
    if (emailInput) emailInput.value = currentUser.email || '';

    // Load saved profile data
    const savedProfile = getStoredProfile();
    if (savedProfile) {
        const profilePhone = document.getElementById('profile-phone');
        const profileJob = document.getElementById('profile-job');
        const profileCompany = document.getElementById('profile-company');
        const profileTimezone = document.getElementById('profile-timezone');
        const profileLanguage = document.getElementById('profile-language');
        const profileRegion = document.getElementById('profile-region');

        if (profilePhone) profilePhone.value = savedProfile.phone || '';
        if (profileJob) profileJob.value = savedProfile.job || '';
        if (profileCompany) profileCompany.value = savedProfile.company || '';
        if (profileTimezone) profileTimezone.value = savedProfile.timezone || 'UTC';
        if (profileLanguage) profileLanguage.value = getSavedLanguagePreference();
        if (profileRegion) profileRegion.value = getSavedRegionPreference();
    }

    // Generate account ID
    const accountId = localStorage.getItem('bytesky_account_id')
        || `acc_${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem('bytesky_account_id', accountId);
    document.getElementById('profile-account-id').innerText = accountId;
    document.getElementById('profile-member-since').innerText = formatLocalizedMonthYear(currentUser.createdAt || new Date());
    document.getElementById('profile-joined').innerText = formatLocalizedMonthYear(currentUser.createdAt || new Date());
    document.getElementById('profile-last-login').innerText = formatRelativeTime(currentUser.lastLogin || currentUser.createdAt || new Date());

    // Load SSH keys
    loadSSHKeys();

    // Load account-backed security alert preferences
    loadLoginAlertPreferences();
    syncProfilePreferencesTexts();

    // Load real active sessions
    loadAuthSessions();

    // Load usage stats
    loadUsageStats();
}

async function loadUsageStats() {
    try {
        const authHeaders = { 'Authorization': `Bearer ${token}` };
        const [vmsResult, storageResult] = await Promise.allSettled([
            fetch(`${API_URL}/instances`, { headers: authHeaders }),
            fetch(`${API_URL}/storage`, { headers: authHeaders })
        ]);

        if (vmsResult.status === 'fulfilled' && vmsResult.value.ok) {
            const vms = await vmsResult.value.json();
            document.getElementById('usage-instances').innerText = `${vms.length} / 10`;
        }

        if (storageResult.status === 'fulfilled' && storageResult.value.ok) {
            const files = await storageResult.value.json();
            const totalSize = files.reduce((sum, f) => sum + (f.fileSize || 0), 0);
            document.getElementById('usage-storage').innerText = `${formatFileSize(totalSize)} / 100 GB`;
        }
    } catch (err) {
        console.error('Error loading usage stats:', err);
    }
}

// ============================================
// ROUTING & NAVIGATION
// ============================================

function router(pageId, options = {}) {
    const skipAuthCheck = Boolean(options.skipAuthCheck);
    const mainContent = getMainContentElement();

    if (!skipAuthCheck && !PUBLIC_PAGES.has(pageId) && !hasAuthenticatedSession()) {
        showToast('Please log in first');
        return router('login', { skipAuthCheck: true });
    }

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    const target = document.getElementById(pageId);
    if (target) {
        target.classList.add('active');
    }

    if (mainContent) {
        mainContent.scrollTo({
            top: 0,
            behavior: pageId === 'home' && !currentUser ? 'smooth' : 'auto'
        });
    }

    document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active-link'));
    const link = document.querySelector(`.sidebar a[onclick="router('${pageId}')"]`);
    if (link) link.classList.add('active-link');

    if (currentUser && isCompactSidebarLayout()) {
        setSidebarOpen(false);
    }

    if (pageId !== 'monitoring' && autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }

    if (pageId !== 'saas' && saasStatusRefreshInterval) {
        clearInterval(saasStatusRefreshInterval);
        saasStatusRefreshInterval = null;
    }

    if (pageId !== 'home') {
        pendingMarketingSectionId = null;
        disconnectMarketingReveal();
    }

    // Trigger page-specific loads
    switch (pageId) {
        case 'iaas':
            loadVMs();
            ensureVmNetworkOptions();
            break;
        case 'billing': loadBilling(); break;
        case 'dashboard': loadDashboardData(); break;
        case 'login':
        case 'register':
            initializeGoogleAuth();
            break;
        case 'profile': loadProfileData(); break;
        case 'monitoring': loadMonitoring(); toggleAutoRefresh(); break;
        case 'storage': loadStorage(); loadBucketsForUpload(); break;  //  Load both
        case 'support': loadTickets(); break;
        case 'iam': showIAMTab(currentIAMTab || 'policies'); break;
        case 'network': loadNetworkResources(); break;
        case 'regions': loadRegions(); break;
        case 'twoFA': load2FAStatus(); break;
        case 'admin': loadAdmin(); break;
        case 'saas': showSaaSTab('marketplace'); startSaaSStatusAutoRefresh(); break;
    }

    if (pageId === 'home' && !currentUser) {
        initializeMarketingReveal();
        if (pendingMarketingSectionId) {
            const sectionId = pendingMarketingSectionId;
            pendingMarketingSectionId = null;
            window.setTimeout(() => {
                scrollMarketingSectionIntoView(sectionId);
            }, 120);
        }
    }

    updateNavScrollState();
}
// ============================================
// MODAL FUNCTIONS
// ============================================

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'flex';
}

// ============================================
// VM CONSOLE
// ============================================

const osConsoleMap = {
    'Windows Server': 'https://copy.sh/v86/?profile=windows2000',
    'Debian 11': 'https://distrosea.com/start/debian-11.0.0-standard/',
    'CentOS 9': 'https://distrosea.com/start/centosstream-10-minimal/',
    'Ubuntu 22.04': 'https://distrosea.com/start/ubuntu-25.10-default/'
};

function handleConsoleClick(os) {
    const url = osConsoleMap[os];

    if (url) {
        window.open(url, '_blank');
        return;
    }

    alert('Console not available for this OS');
}

function openVMConsole(os) {
    handleConsoleClick(os);
}

function closeVMConsole() {
    closeModal('vmConsoleModal');
}

function handleConsoleInput(event) {
    if (event.key === 'Enter') executeConsoleCommand();
}

function executeConsoleCommand() {
    const input = document.getElementById('consoleInput');
    const output = document.getElementById('consoleOutput');
    if (!input || !output) return;

    const cmd = input.value.trim();
    if (!cmd) return;

    output.innerHTML += `<div>user@vm:~$ ${cmd}</div>`;

    let response = '';
    switch (cmd.toLowerCase()) {
        case 'help': response = 'Available commands: help, uname, date, ls, clear, whoami, pwd'; break;
        case 'uname': response = 'Linux vm 5.15.0 x86_64 GNU/Linux'; break;
        case 'date': response = new Date().toString(); break;
        case 'ls': response = 'documents  downloads  projects'; break;
        case 'whoami': response = 'user'; break;
        case 'pwd': response = '/home/user'; break;
        case 'clear': output.innerHTML = ''; input.value = ''; return;
        default: response = `bash: ${cmd}: command not found`;
    }

    output.innerHTML += `<div style="color:#ccc">${response}</div><div>user@vm:~$ </div>`;
    input.value = '';
    output.scrollTop = output.scrollHeight;
}

// ============================================
// COMPUTE (IaaS)
// ============================================

async function createVM() {
    if (!networkVpcCache.length) {
        await ensureVmNetworkOptions();
    }

    const name = document.getElementById('vmName')?.value?.trim();
    const region = document.getElementById('vmRegion')?.value;
    const vpcId = document.getElementById('vmVpc')?.value;
    const subnetId = document.getElementById('vmSubnet')?.value;
    const os = document.getElementById('vmOS')?.value;
    const size = document.getElementById('vmSize')?.value;
    const securityGroup = document.getElementById('vmSecurityGroup')?.value || 'default';

    if (!name) {
        showToast('Enter instance name');
        return;
    }

    if (!vpcId || !subnetId) {
        showToast('Choose a VPC and subnet before launching an instance');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/instances`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, region, vpcId, subnetId, os, size, securityGroup })
        });

        if (res.ok) {
            showToast('Instance provisioning started...');
            const nameInput = document.getElementById('vmName');
            if (nameInput) nameInput.value = '';
            await Promise.all([loadVMs(), loadNetworkResources()]);
        } else {
            const data = await res.json();
            showToast(data.msg || 'Failed to launch instance');
        }
    } catch (err) {
        console.error('Create VM Error:', err);
        showToast('Error creating instance');
    }
}

async function loadVMs() {
    try {
        const res = await fetch(`${API_URL}/instances`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) return;

        const vms = await res.json();
        const tbody = document.getElementById('vm-list');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (vms.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b; padding:20px;">No instances found. Launch one above.</td></tr>';
            return;
        }

        vms.forEach(vm => {
            const badgeClass = vm.status === 'running' ? 'bg-running' :
                vm.status === 'stopped' ? 'bg-stopped' : 'bg-provisioning';

            tbody.innerHTML += `
                <tr>
                    <td><strong>${vm.name}</strong><br><small style="color:#64748b">${vm._id?.slice(-8) || 'N/A'}</small></td>
                    <td>${vm.region || 'us-east-1'}</td>
                    <td>${vm.ip || 'N/A'}</td>
                    <td><span class="badge ${badgeClass}">${vm.status}</span></td>
                    <td>$${(vm.hourlyRate || 0.0068).toFixed(4)}/hr</td>
                    <td>
                        ${vm.status === 'running' ?
                    `<button class="btn btn-outline" style="font-size:0.7rem; margin-right:5px;" onclick="openVMConsole('${escapeJsString(vm.os || '')}')" title="Open Console">Console</button>` : ''}
                        <button class="btn btn-danger" style="font-size:0.7rem;" onclick="deleteVM('${vm._id}')">X Terminate</button>
                    </td>
                </tr>
            `;
        });
    } catch (err) {
        console.error('Load VMs Error:', err);
    }
}

let pendingDeleteVM = null;

function toggleInstanceActionMenu(event, id) {
    event.stopPropagation();
    const targetMenuId = `instance-action-${id}`;
    document.querySelectorAll('.instance-action-menu-list').forEach((menu) => {
        if (menu.id === targetMenuId) {
            menu.classList.toggle('show');
        } else {
            menu.classList.remove('show');
        }
    });
}

function promptDeleteVM(id, name = 'this instance') {
    pendingDeleteVM = { id, name };
    const nameEl = document.getElementById('deleteVmName');
    const bodyEl = document.getElementById('deleteVmMessage');
    if (nameEl) nameEl.textContent = name;
    if (bodyEl) bodyEl.textContent = `This will permanently delete ${name}. This action cannot be undone.`;
    openModal('deleteVmModal');
    document.querySelectorAll('.instance-action-menu-list').forEach((menu) => menu.classList.remove('show'));
}

function cancelDeleteVM() {
    pendingDeleteVM = null;
    closeModal('deleteVmModal');
}

async function confirmDeleteVM() {
    if (!pendingDeleteVM?.id) {
        closeModal('deleteVmModal');
        return;
    }

    const { id } = pendingDeleteVM;
    pendingDeleteVM = null;
    closeModal('deleteVmModal');
    await deleteVM(id, { skipConfirm: true });
}

async function deleteVM(id, options = {}) {
    const { skipConfirm = false } = options;
    if (!skipConfirm && !confirm('Terminate instance? This cannot be undone.')) return;

    try {
        const res = await fetch(`${API_URL}/instances/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            showToast('Instance terminated');
            await Promise.all([loadVMs(), loadNetworkResources()]);
        } else {
            showToast('Failed to terminate instance');
        }
    } catch (err) {
        console.error('Delete VM Error:', err);
        showToast('Error deleting instance');
    }
}

let selectedInstances = [];
let allInstances = [];

async function loadVMs() {
    try {
        const res = await fetch(`${API_URL}/instances`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            console.error('Failed to load VMs:', res.status);
            return;
        }

        allInstances = await res.json();
        filterInstances(); // Apply filters and render
    } catch (err) {
        console.error('Load VMs Error:', err);
        showToast('Error loading instances');
    }
}

function filterInstances() {
    const searchTerm = document.getElementById('instanceSearch')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('filterStatus')?.value || 'all';
    const regionFilter = document.getElementById('filterRegion')?.value || 'all';

    let filtered = allInstances;

    // Apply search filter
    if (searchTerm) {
        filtered = filtered.filter(vm =>
            vm.name.toLowerCase().includes(searchTerm) ||
            (vm.ip && vm.ip.includes(searchTerm)) ||
            (vm.privateIp && vm.privateIp.includes(searchTerm)) ||
            (vm.vpcName && vm.vpcName.toLowerCase().includes(searchTerm)) ||
            (vm.subnetName && vm.subnetName.toLowerCase().includes(searchTerm)) ||
            (vm._id && vm._id.toLowerCase().includes(searchTerm))
        );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
        filtered = filtered.filter(vm => vm.status === statusFilter);
    }

    // Apply region filter
    if (regionFilter !== 'all') {
        filtered = filtered.filter(vm => vm.region === regionFilter);
    }

    renderInstances(filtered);
}

function renderInstances(vms) {
    const tbody = document.getElementById('vm-list');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (vms.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#64748b; padding:40px;">No instances found. Launch one above or adjust your filters.</td></tr>';
        return;
    }

    vms.forEach(vm => {
        const isSelected = selectedInstances.includes(vm._id);
        const uptime = calculateUptime(vm.createdAt);
        const badgeClass = vm.status === 'running' ? 'badge-running' :
            vm.status === 'stopped' ? 'badge-stopped' : 'badge-provisioning';

        tbody.innerHTML += `
            <tr>
                <td>
                    <input type="checkbox" class="instance-checkbox" 
                           value="${vm._id}" 
                           ${isSelected ? 'checked' : ''} 
                           onchange="toggleInstanceSelection('${vm._id}')">
                </td>
                <td>
                    <strong>${vm.name}</strong><br>
                    <small style="color:#64748b">${vm._id?.slice(-8) || 'N/A'}</small>
                </td>
                <td>${vm.region || 'us-east-1'}</td>
                <td>
                    <strong>${vm.vpcName || 'Legacy / Unattached'}</strong><br>
                    <small style="color:#64748b">${vm.subnetName || 'No subnet linked'}</small>
                </td>
                <td>
                    ${vm.ip || 'N/A'}<br>
                    <small style="color:#64748b">${vm.privateIp || 'Private IP pending'}</small>
                </td>
                <td><span class="${badgeClass}">${vm.status}</span></td>
                <td>$${(vm.hourlyRate || 0.0068).toFixed(4)}/hr</td>
                <td>${uptime}</td>
                <td>
                    ${renderInstanceActions(vm)}
                </td>
            </tr>
        `;
    });
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeJsString(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '')
        .replace(/\n/g, '\\n');
}

function getInstanceActionIcon(icon) {
    const icons = {
        terminal: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.22 5.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06L5.28 12.78a.75.75 0 0 1-1.06-1.06L6.94 9 4.22 6.28a.75.75 0 0 1 0-1.06ZM9.75 12a.75.75 0 0 1 .75-.75h4a.75.75 0 0 1 0 1.5h-4a.75.75 0 0 1-.75-.75Z"/></svg>',
        restart: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3.25A6.75 6.75 0 1 0 16.75 10a.75.75 0 0 0-1.5 0A5.25 5.25 0 1 1 10 4.75h2.19l-1.22 1.22a.75.75 0 1 0 1.06 1.06l2.5-2.5a.75.75 0 0 0 0-1.06l-2.5-2.5a.75.75 0 1 0-1.06 1.06l1.22 1.22H10Z"/></svg>',
        start: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.5 4.75c0-1.15 1.25-1.87 2.25-1.3l6 3.5c1 .58 1 2.02 0 2.6l-6 3.5c-1 .57-2.25-.15-2.25-1.3v-7Z"/></svg>',
        stop: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.75 4A1.75 1.75 0 0 0 4 5.75v8.5C4 15.216 4.784 16 5.75 16h8.5A1.75 1.75 0 0 0 16 14.25v-8.5A1.75 1.75 0 0 0 14.25 4h-8.5Z"/></svg>',
        details: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm-1.25 4.25A.75.75 0 0 1 9.5 7.5h.5a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0v-4.25H9.5a.75.75 0 0 1-.75-.75Z"/></svg>',
        logs: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 4.75A1.75 1.75 0 0 1 6.75 3h6.5A1.75 1.75 0 0 1 15 4.75v10.5A1.75 1.75 0 0 1 13.25 17h-6.5A1.75 1.75 0 0 1 5 15.25V4.75Zm2 1a.75.75 0 0 0 0 1.5h6a.75.75 0 0 0 0-1.5H7Zm0 3.5a.75.75 0 0 0 0 1.5h6a.75.75 0 0 0 0-1.5H7Zm0 3.5a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5H7Z"/></svg>',
        metrics: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.75 15A1.75 1.75 0 0 1 3 13.25v-6.5C3 5.784 3.784 5 4.75 5h10.5c.966 0 1.75.784 1.75 1.75v6.5A1.75 1.75 0 0 1 15.25 15H4.75Zm1.5-2.25a.75.75 0 0 0 1.5 0V9.5a.75.75 0 0 0-1.5 0v3.25Zm3 0a.75.75 0 0 0 1.5 0V7.25a.75.75 0 0 0-1.5 0v5.5Zm3 0a.75.75 0 0 0 1.5 0V10.5a.75.75 0 0 0-1.5 0v2.25Z"/></svg>',
        menu: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm4.5 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm4.5 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z"/></svg>',
        trash: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8.75 3.5A1.75 1.75 0 0 1 10.5 1.75h1A1.75 1.75 0 0 1 13.25 3.5V4H16a.75.75 0 0 1 0 1.5h-.56l-.72 9.02A2 2 0 0 1 12.73 16.5H7.27a2 2 0 0 1-1.99-1.98L4.56 5.5H4a.75.75 0 0 1 0-1.5h2.75v-.5ZM9.5 4h3v-.5a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25V4Zm-1 3a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0v-5A.75.75 0 0 1 8.5 7Zm3 0a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0v-5A.75.75 0 0 1 11.5 7Z"/></svg>'
    };

    return icons[icon] || icons.details;
}

function renderInstanceActionButton({ title, icon, variant = 'neutral', action, label }) {
    const safeTitle = escapeHtml(title);
    const safeLabel = escapeHtml(label || title);
    return `
        <button
            type="button"
            class="instance-action-btn ${variant === 'danger' ? 'danger' : variant === 'primary' ? 'primary' : ''}"
            onclick="${action}"
            title="${safeTitle}"
            aria-label="${safeLabel}"
            data-tooltip="${safeTitle}">
            ${getInstanceActionIcon(icon)}
        </button>
    `;
}

function renderInstanceActions(vm) {
    const safeVmId = escapeJsString(vm._id);
    const safeVmName = escapeJsString(vm.name || 'Instance');
    const primaryActions = [];
    const menuActions = [];

    if (vm.status === 'running') {
        primaryActions.push(renderInstanceActionButton({
            title: 'Open Console',
            icon: 'terminal',
            variant: 'primary',
            action: `openVMConsole('${escapeJsString(vm.os || '')}')`,
            label: `Open console for ${vm.name || 'instance'}`
        }));
        primaryActions.push(renderInstanceActionButton({
            title: 'Restart',
            icon: 'restart',
            action: `rebootInstance('${safeVmId}')`,
            label: `Restart ${vm.name || 'instance'}`
        }));
        menuActions.push(`
            <button type="button" onclick="stopInstance('${safeVmId}')">
                <span class="instance-action-menu-icon">${getInstanceActionIcon('stop')}</span>
                <span>Stop instance</span>
            </button>
        `);
    } else if (vm.status === 'stopped') {
        primaryActions.push(renderInstanceActionButton({
            title: 'Start',
            icon: 'start',
            variant: 'primary',
            action: `startInstance('${safeVmId}')`,
            label: `Start ${vm.name || 'instance'}`
        }));
        primaryActions.push(renderInstanceActionButton({
            title: 'View Details',
            icon: 'details',
            action: `viewInstanceDetails('${safeVmId}')`,
            label: `View details for ${vm.name || 'instance'}`
        }));
    } else {
        primaryActions.push(renderInstanceActionButton({
            title: 'View Details',
            icon: 'details',
            action: `viewInstanceDetails('${safeVmId}')`,
            label: `View details for ${vm.name || 'instance'}`
        }));
    }

    menuActions.push(`
        <button type="button" onclick="viewInstanceDetails('${safeVmId}')">
            <span class="instance-action-menu-icon">${getInstanceActionIcon('details')}</span>
            <span>View details</span>
        </button>
    `);
    menuActions.push(`
        <button type="button" onclick="viewInstanceLogs('${safeVmId}')">
            <span class="instance-action-menu-icon">${getInstanceActionIcon('logs')}</span>
            <span>View logs</span>
        </button>
    `);
    menuActions.push(`
        <button type="button" onclick="showResourceUtilization('${safeVmId}')">
            <span class="instance-action-menu-icon">${getInstanceActionIcon('metrics')}</span>
            <span>View metrics</span>
        </button>
    `);
    menuActions.push(`
        <button type="button" class="danger" onclick="promptDeleteVM('${safeVmId}', '${safeVmName}')">
            <span class="instance-action-menu-icon">${getInstanceActionIcon('trash')}</span>
            <span>Delete instance</span>
        </button>
    `);

    return `
        <div class="instance-actions" aria-label="Instance actions">
            <div class="instance-actions-primary">
                ${primaryActions.join('')}
            </div>
            <div class="instance-action-menu">
                <button
                    type="button"
                    class="instance-action-btn instance-action-menu-trigger"
                    onclick="toggleInstanceActionMenu(event, '${safeVmId}')"
                    title="More actions"
                    aria-label="More actions"
                    data-tooltip="More actions">
                    ${getInstanceActionIcon('menu')}
                </button>
                <div class="instance-action-menu-list" id="instance-action-${safeVmId}">
                    ${menuActions.join('')}
                </div>
            </div>
        </div>
    `;
}

function calculateUptime(createdAt) {
    if (!createdAt) return translate('general.unknown');
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now - created;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffDays > 0) return `${diffDays}d ${diffHours}h`;
    if (diffHours > 0) return `${diffHours}h ${diffMinutes}m`;
    return `${diffMinutes}m`;
}

// Bulk Actions
function toggleSelectAll() {
    const selectAll = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.instance-checkbox');

    if (selectAll.checked) {
        selectedInstances = allInstances.map(vm => vm._id);
    } else {
        selectedInstances = [];
    }

    checkboxes.forEach(cb => cb.checked = selectAll.checked);
    updateBulkActionsBar();
}

function toggleInstanceSelection(instanceId) {
    const index = selectedInstances.indexOf(instanceId);
    if (index > -1) {
        selectedInstances.splice(index, 1);
    } else {
        selectedInstances.push(instanceId);
    }
    updateBulkActionsBar();
}

function updateBulkActionsBar() {
    const bulkBar = document.getElementById('bulkActionsBar');
    const countLabel = document.getElementById('selectedCount');

    if (selectedInstances.length > 0) {
        bulkBar.style.display = 'block';
        countLabel.innerText = `${selectedInstances.length} instance${selectedInstances.length > 1 ? 's' : ''} selected`;
    } else {
        bulkBar.style.display = 'none';
        document.getElementById('selectAll').checked = false;
    }
}

function openBulkActions() {
    const checkboxes = document.querySelectorAll('.instance-checkbox');
    const hasChecked = Array.from(checkboxes).some(cb => cb.checked);

    if (hasChecked || selectedInstances.length > 0) {
        updateBulkActionsBar();
    } else {
        showToast('Select instances first');
    }
}

function closeBulkActions() {
    document.getElementById('bulkActionsBar').style.display = 'none';
    selectedInstances = [];
    document.querySelectorAll('.instance-checkbox').forEach(cb => cb.checked = false);
}

async function bulkStart() {
    for (const id of selectedInstances) {
        await startInstance(id);
    }
    closeBulkActions();
    loadVMs();
}

async function bulkStop() {
    for (const id of selectedInstances) {
        await stopInstance(id);
    }
    closeBulkActions();
    loadVMs();
}

async function bulkReboot() {
    for (const id of selectedInstances) {
        await rebootInstance(id);
    }
    closeBulkActions();
    loadVMs();
}

async function bulkTerminate() {
    if (!confirm(`Terminate ${selectedInstances.length} instance(s)? This cannot be undone.`)) return;

    for (const id of selectedInstances) {
        await deleteVM(id, { skipConfirm: true });
    }
    closeBulkActions();
    loadVMs();
}

// Instance Actions
async function startInstance(id) {
    try {
        const res = await fetch(`${API_URL}/instances/${id}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: 'running' })
        });

        if (res.ok) {
            showToast('Instance started');
            await Promise.all([loadVMs(), loadNetworkResources()]);
        } else {
            showToast('Failed to start instance');
        }
    } catch (err) {
        showToast('Error starting instance');
    }
}

async function stopInstance(id) {
    try {
        const res = await fetch(`${API_URL}/instances/${id}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: 'stopped' })
        });

        if (res.ok) {
            showToast('Instance stopped');
            await Promise.all([loadVMs(), loadNetworkResources()]);
        } else {
            showToast('Failed to stop instance');
        }
    } catch (err) {
        showToast('Error stopping instance');
    }
}

async function rebootInstance(id) {
    try {
        showToast('Rebooting instance...');
        await stopInstance(id);
        await new Promise(resolve => setTimeout(resolve, 3000));
        await startInstance(id);
        showToast('Instance rebooted');
    } catch (err) {
        showToast('Error rebooting instance');
    }
}

// View Instance Details
async function viewInstanceDetails(id) {
    let vm = allInstances.find(v => v._id === id);

    if (!vm) {
        try {
            const res = await fetch(`${API_URL}/instances/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) {
                showToast('Unable to load instance details');
                return;
            }

            vm = await res.json();
            if (!allInstances.some(instance => instance._id === vm._id)) {
                allInstances.unshift(vm);
            }
        } catch (err) {
            showToast('Unable to load instance details');
            return;
        }
    }

    const content = document.getElementById('instanceDetailsContent');
    content.innerHTML = `
        <div class="details-grid">
            <div class="detail-item">
                <div class="detail-label">Instance ID</div>
                <div class="detail-value">${vm._id}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Name</div>
                <div class="detail-value">${vm.name}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Status</div>
                <div class="detail-value"><span class="badge-${vm.status}">${vm.status}</span></div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Region</div>
                <div class="detail-value">${vm.region || 'us-east-1'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Public IP</div>
                <div class="detail-value">${vm.ip || 'N/A'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Private IP</div>
                <div class="detail-value">${vm.privateIp || 'Pending'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">VPC</div>
                <div class="detail-value">${vm.vpcName || 'Not attached'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Subnet</div>
                <div class="detail-value">${vm.subnetName || 'Not attached'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Subnet CIDR</div>
                <div class="detail-value">${vm.subnetCidr || 'N/A'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Availability Zone</div>
                <div class="detail-value">${vm.availabilityZone ? String(vm.availabilityZone).toUpperCase() : 'N/A'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Security Group</div>
                <div class="detail-value">${vm.securityGroup || 'default'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">OS</div>
                <div class="detail-value">${vm.os || 'Ubuntu 22.04'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Size</div>
                <div class="detail-value">${vm.size || 'micro'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Hourly Rate</div>
                <div class="detail-value">$${(vm.hourlyRate || 0.0068).toFixed(4)}/hr</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Launch Time</div>
                <div class="detail-value">${formatLocalizedDateTime(vm.createdAt)}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Uptime</div>
                <div class="detail-value">${calculateUptime(vm.createdAt)}</div>
            </div>
        </div>
    `;

    openModal('instanceDetailsModal');
}

// View Instance Logs
async function viewInstanceLogs(id) {
    const vm = allInstances.find(v => v._id === id);
    if (!vm) return;

    const logs = [
        `[${new Date().toISOString()}] Instance ${vm.name} started`,
        `[${new Date(Date.now() - 60000).toISOString()}] SSH service started on port 22`,
        `[${new Date(Date.now() - 120000).toISOString()}] Network interface eth0 configured`,
        `[${new Date(Date.now() - 180000).toISOString()}] Cloud-init completed`,
        `[${new Date(Date.now() - 240000).toISOString()}] System boot completed`,
        `[${new Date(Date.now() - 300000).toISOString()}] Kernel: Linux 5.15.0-generic`,
        `[${new Date(Date.now() - 360000).toISOString()}] Memory: 1024MB total`,
        `[${new Date(Date.now() - 420000).toISOString()}] CPU: 1 core(s) detected`
    ];

    const content = document.getElementById('logsContent');
    content.innerHTML = logs.map(log => `
        <div class="log-entry">
            <span class="log-timestamp">${log.split(']')[0]}]</span>
            <span>${log.split(']')[1]}</span>
        </div>
    `).join('');

    openModal('logsModal');
}

// Show Resource Utilization
async function showResourceUtilization(id) {
    const vm = allInstances.find(v => v._id === id);
    if (!vm) return;

    // Simulate resource metrics
    const cpu = Math.floor(Math.random() * 60) + 20;
    const ram = Math.floor(Math.random() * 50) + 30;
    const disk = Math.floor(Math.random() * 40) + 20;
    const networkIn = (Math.random() * 5).toFixed(2);
    const networkOut = (Math.random() * 2).toFixed(2);

    const content = document.getElementById('resourceUtilContent');
    content.innerHTML = `
        <h4 style="margin-bottom: 20px;">${vm.name}</h4>
        
        <div class="utilization-bar">
            <div class="utilization-label">
                <span>CPU Usage</span>
                <span>${cpu}%</span>
            </div>
            <div class="utilization-progress">
                <div class="utilization-fill ${cpu > 80 ? 'danger' : cpu > 60 ? 'warning' : ''}" style="width: ${cpu}%"></div>
            </div>
        </div>
        
        <div class="utilization-bar">
            <div class="utilization-label">
                <span>Memory Usage</span>
                <span>${ram}%</span>
            </div>
            <div class="utilization-progress">
                <div class="utilization-fill ${ram > 80 ? 'danger' : ram > 60 ? 'warning' : ''}" style="width: ${ram}%"></div>
            </div>
        </div>
        
        <div class="utilization-bar">
            <div class="utilization-label">
                <span>Disk Usage</span>
                <span>${disk}%</span>
            </div>
            <div class="utilization-progress">
                <div class="utilization-fill ${disk > 80 ? 'danger' : disk > 60 ? 'warning' : ''}" style="width: ${disk}%"></div>
            </div>
        </div>
        
        <div style="margin-top: 20px; padding: 15px; background: #f8fafc; border-radius: 6px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div>
                    <div style="font-size: 0.8rem; color: #64748b;">Network In</div>
                    <div style="font-weight: 600;">${networkIn} MB/s</div>
                </div>
                <div>
                    <div style="font-size: 0.8rem; color: #64748b;">Network Out</div>
                    <div style="font-weight: 600;">${networkOut} MB/s</div>
                </div>
            </div>
        </div>
    `;

    openModal('resourceUtilModal');
}

// SSH Key Management
function openSSHKeyModal() {
    loadSSHKeys();
    openModal('sshKeyModal');
}

function createSSHKey() {
    const name = prompt('Enter key pair name:');
    if (!name) return;

    // Generate fake SSH key fingerprint
    const fingerprint = 'SHA256:' + Array(43).fill(0).map(() =>
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'[Math.floor(Math.random() * 64)]
    ).join('');

    const newKey = {
        id: 'key-' + Date.now(),
        name,
        fingerprint,
        key: fingerprint,
        addedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
    };

    const keys = getStoredSSHKeys();
    keys.push(newKey);
    persistSSHKeys(keys);

    // Show the private key (simulated)
    alert(`Key pair "${name}" created successfully!\n\n IMPORTANT: In a real system, you would download the private key (.pem file) here. This key cannot be recovered later.\n\nFingerprint: ${fingerprint}`);

    loadSSHKeys();
}

// Filter & Search
function resetFilters() {
    document.getElementById('instanceSearch').value = '';
    document.getElementById('filterStatus').value = 'all';
    document.getElementById('filterRegion').value = 'all';
    filterInstances();
}

function refreshInstances() {
    showToast('Refreshing instances...');
    loadVMs();
}

// ============================================
// NETWORK: VPC & Load Balancer
// ============================================

let networkVpcCache = [];
let networkRouteTableCache = [];
let networkLoadBalancerCache = [];
let networkInstanceTargetCache = [];

async function ensureVmNetworkOptions(forceRefresh = false) {
    if (forceRefresh || !networkVpcCache.length) {
        await loadNetworkResources();
        return;
    }

    syncVmVpcOptions();
}

function syncVmVpcOptions(preferredVpcId = '') {
    const region = document.getElementById('vmRegion')?.value || 'us-east-1';
    const vpcSelect = document.getElementById('vmVpc');
    if (!vpcSelect) return;

    const matchingVpcs = networkVpcCache.filter(vpc => vpc.region === region);
    const vpcOptions = matchingVpcs.map(vpc => ({
        value: vpc._id,
        label: `${vpc.name} (${vpc.cidr})`
    }));

    populateNetworkSelect('vmVpc', vpcOptions, matchingVpcs.length ? 'Select VPC' : `No VPCs in ${region}`, true);

    const nextVpcId = preferredVpcId
        || (matchingVpcs.some(vpc => vpc._id === vpcSelect.value) ? vpcSelect.value : '')
        || (vpcOptions[0]?.value || '');

    vpcSelect.value = nextVpcId;
    syncVmSubnetOptions();
}

function syncVmSubnetOptions(preferredSubnetId = '') {
    const selectedVpcId = document.getElementById('vmVpc')?.value;
    const subnetSelect = document.getElementById('vmSubnet');
    if (!subnetSelect) return;

    const selectedVpc = networkVpcCache.find(vpc => vpc._id === selectedVpcId);
    const subnetOptions = (selectedVpc?.subnets || []).map(subnet => ({
        value: subnet._id,
        label: `${subnet.name} (${subnet.cidr} | ${subnet.type})`
    }));

    populateNetworkSelect('vmSubnet', subnetOptions, selectedVpc ? 'Select Subnet' : 'Select VPC first', true);

    const nextSubnetId = preferredSubnetId
        || (subnetOptions.some(subnet => subnet.value === subnetSelect.value) ? subnetSelect.value : '')
        || (subnetOptions[0]?.value || '');

    subnetSelect.value = nextSubnetId;
}

function handleVmRegionChange() {
    syncVmVpcOptions();
}

function handleVmVpcChange() {
    const selectedVpcId = document.getElementById('vmVpc')?.value;
    const regionSelect = document.getElementById('vmRegion');
    const selectedVpc = networkVpcCache.find(vpc => vpc._id === selectedVpcId);

    if (selectedVpc && regionSelect) {
        regionSelect.value = selectedVpc.region;
    }

    syncVmSubnetOptions();
}

function getNetworkStatusClass(status) {
    switch (String(status || '').toLowerCase()) {
        case 'available':
        case 'active':
        case 'healthy':
        case 'running':
            return 'bg-running';
        case 'failed':
        case 'unhealthy':
            return 'bg-error';
        default:
            return 'bg-provisioning';
    }
}

function getNetworkBadgeClass(status) {
    switch (String(status || '').toLowerCase()) {
        case 'available':
        case 'active':
        case 'healthy':
        case 'running':
            return 'network-pill network-pill-available';
        case 'public':
            return 'network-pill network-pill-public';
        case 'main':
            return 'network-pill network-pill-main';
        case 'failed':
        case 'unhealthy':
            return 'network-pill network-pill-warning';
        default:
            return 'network-pill network-pill-neutral';
    }
}

function getNetworkEmptyStateMarkup({ icon = 'layers', title, description, actionLabel, actionHandler }) {
    const icons = {
        loadBalancer: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.75 4A1.75 1.75 0 0 0 3 5.75v2.5C3 9.216 3.784 10 4.75 10h2.19a3.251 3.251 0 0 0 6.12 0h2.19A1.75 1.75 0 0 0 17 8.25v-2.5A1.75 1.75 0 0 0 15.25 4H4.75Zm0 1.5h10.5a.25.25 0 0 1 .25.25v2.5a.25.25 0 0 1-.25.25h-2.19a3.251 3.251 0 0 0-6.12 0H4.75a.25.25 0 0 1-.25-.25v-2.5a.25.25 0 0 1 .25-.25ZM10 9a1.75 1.75 0 1 1 0 3.5A1.75 1.75 0 0 1 10 9Zm-5.25 4A1.75 1.75 0 0 0 3 14.75v.5C3 16.216 3.784 17 4.75 17h10.5A1.75 1.75 0 0 0 17 15.25v-.5A1.75 1.75 0 0 0 15.25 13h-2.19a3.251 3.251 0 0 1-6.12 0H4.75Z"/></svg>',
        subnets: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.75 3h10.5A1.75 1.75 0 0 1 17 4.75v2.5A1.75 1.75 0 0 1 15.25 9H4.75A1.75 1.75 0 0 1 3 7.25v-2.5A1.75 1.75 0 0 1 4.75 3Zm0 8h10.5A1.75 1.75 0 0 1 17 12.75v2.5A1.75 1.75 0 0 1 15.25 17H4.75A1.75 1.75 0 0 1 3 15.25v-2.5A1.75 1.75 0 0 1 4.75 11Z"/></svg>',
        routeTable: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 5.75A1.75 1.75 0 0 1 5.75 4h8.5A1.75 1.75 0 0 1 16 5.75v1.5A1.75 1.75 0 0 1 14.25 9h-8.5A1.75 1.75 0 0 1 4 7.25v-1.5Zm1.75-.25a.25.25 0 0 0-.25.25v1.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-1.5a.25.25 0 0 0-.25-.25h-8.5ZM4 12.75A1.75 1.75 0 0 1 5.75 11h8.5A1.75 1.75 0 0 1 16 12.75v1.5A1.75 1.75 0 0 1 14.25 16h-8.5A1.75 1.75 0 0 1 4 14.25v-1.5Z"/></svg>',
        layers: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.75 3 6.5l7 3.75 7-3.75-7-3.75Zm-5.78 6.3L3 9.75 10 13.5l7-3.75-1.22-.7L10 12.25 4.22 9.05Zm0 3.25L3 13l7 3.75L17 13l-1.22-.7L10 15.5l-5.78-3.2Z"/></svg>'
    };

    return `
        <div class="network-empty-state">
            <div class="network-empty-icon">${icons[icon] || icons.layers}</div>
            <h4>${title}</h4>
            <p>${description}</p>
            ${actionLabel && actionHandler ? `<button class="network-action-btn network-action-btn--primary" onclick="${actionHandler}">${actionLabel}</button>` : ''}
        </div>
    `;
}

function getNetworkSummaryTotals(vpcs = [], routeTables = [], loadBalancers = [], instanceTargets = []) {
    return {
        vpcs: vpcs.length,
        subnets: vpcs.reduce((total, vpc) => total + (vpc.subnets?.length || 0), 0),
        routeTables: routeTables.length,
        loadBalancers: loadBalancers.length,
        healthyTargets: loadBalancers.reduce((total, lb) => total + (lb.healthyTargetCount || 0), 0),
        runningInstances: instanceTargets.filter(instance => instance.status === 'running').length
    };
}

function renderNetworkSummary(summary = {}) {
    const container = document.getElementById('network-summary');
    if (!container) return;

    const cards = [
        {
            label: 'VPCs',
            value: summary.vpcs || 0,
            detail: `${summary.subnets || 0} subnet${(summary.subnets || 0) === 1 ? '' : 's'} configured`
        },
        {
            label: 'Route Tables',
            value: summary.routeTables || 0,
            detail: 'Main and custom traffic policies'
        },
        {
            label: 'Load Balancers',
            value: summary.loadBalancers || 0,
            detail: `${summary.healthyTargets || 0} healthy target${(summary.healthyTargets || 0) === 1 ? '' : 's'}`
        },
        {
            label: 'Running Targets',
            value: summary.runningInstances || 0,
            detail: 'Instances ready for traffic'
        }
    ];

    container.innerHTML = cards.map(card => `
        <div class="stat-card">
            <div>
                <div class="stat-label">${card.label}</div>
                <div class="stat-val">${card.value}</div>
                <div style="font-size:0.8rem; color:#64748b; margin-top:6px;">${card.detail}</div>
            </div>
        </div>
    `).join('');
}

function populateNetworkSelect(selectId, options, fallbackLabel, includeEmptyOption = false) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const previousValue = select.value;
    const optionMarkup = options.map(item => `<option value="${item.value}">${item.label}</option>`).join('');

    select.innerHTML = includeEmptyOption
        ? `<option value="">${fallbackLabel}</option>${optionMarkup}`
        : optionMarkup || `<option value="">${fallbackLabel}</option>`;

    if (previousValue && [...select.options].some(option => option.value === previousValue)) {
        select.value = previousValue;
    }
}

function populateNetworkVpcOptions() {
    const vpcOptions = networkVpcCache.map(vpc => ({
        value: vpc._id,
        label: `${vpc.name} (${vpc.cidr})`
    }));

    populateNetworkSelect('subnetVpc', vpcOptions, 'Select VPC');
    populateNetworkSelect('routeTableVpc', vpcOptions, 'Select VPC');
    populateNetworkSelect('lbVpc', vpcOptions, 'Select VPC');
    refreshRouteTableSubnetOptions();
}

function populateNetworkTargetOptions() {
    const container = document.getElementById('lbTargetOptions');
    if (!container) return;

    const selectedVpcId = document.getElementById('lbVpc')?.value || '';
    const selectedTargetIds = new Set(
        [...document.querySelectorAll('input[name="lbTargetInstances"]:checked')].map(input => input.value)
    );

    if (!selectedVpcId) {
        container.innerHTML = '<div style="color:#64748b;">Choose a VPC first to see compatible instance targets.</div>';
        return;
    }

    const availableTargets = networkInstanceTargetCache.filter(instance => instance.vpcId === selectedVpcId);
    const selectedVpc = networkVpcCache.find(vpc => vpc._id === selectedVpcId);

    if (!availableTargets.length) {
        container.innerHTML = `<div style="color:#64748b;">No compute instances are attached to ${selectedVpc?.name || 'this VPC'} yet. Launch one there first.</div>`;
        return;
    }

    container.innerHTML = availableTargets.map(instance => `
        <label style="display:flex; align-items:flex-start; gap:10px; margin:0; cursor:pointer;">
            <input type="checkbox" name="lbTargetInstances" value="${instance._id}" style="width:auto; margin:0;" ${selectedTargetIds.has(instance._id) ? 'checked' : ''}>
            <span style="flex:1;">
                <strong style="color:var(--dark);">${instance.name}</strong>
                <div style="font-size:0.82rem; color:#64748b; margin-top:4px;">
                    ${instance.region} | ${instance.subnetName || 'No subnet'} | ${instance.privateIp || instance.publicIp || instance.ip || 'IP pending'}
                </div>
            </span>
            <span class="badge ${getNetworkStatusClass(instance.status)}">${instance.status}</span>
        </label>
    `).join('');
}

function updateLbListenerDefaults() {
    const type = document.getElementById('lbType')?.value || 'application';
    const protocolSelect = document.getElementById('lbProtocol');
    const portInput = document.getElementById('lbPort');
    if (!protocolSelect || !portInput) return;

    const protocols = type === 'application'
        ? [
            { value: 'HTTP', label: 'HTTP' },
            { value: 'HTTPS', label: 'HTTPS' }
        ]
        : [
            { value: 'TCP', label: 'TCP' },
            { value: 'TLS', label: 'TLS' },
            { value: 'UDP', label: 'UDP' }
        ];
    const defaultProtocol = type === 'application' ? 'HTTP' : 'TCP';
    const defaultPort = type === 'application' ? 80 : 443;
    const currentProtocol = protocolSelect.value;
    const currentPort = portInput.value;

    protocolSelect.innerHTML = protocols
        .map(protocol => `<option value="${protocol.value}">${protocol.label}</option>`)
        .join('');
    protocolSelect.value = protocols.some(protocol => protocol.value === currentProtocol)
        ? currentProtocol
        : defaultProtocol;

    if (!currentPort || Number.parseInt(currentPort, 10) === 80 || Number.parseInt(currentPort, 10) === 443) {
        portInput.value = defaultPort;
    }
}

function syncLbRegionWithVpcSelection() {
    const selectedVpcId = document.getElementById('lbVpc')?.value;
    const regionSelect = document.getElementById('lbRegion');
    const selectedVpc = networkVpcCache.find(vpc => vpc._id === selectedVpcId);

    if (selectedVpc && regionSelect) {
        regionSelect.value = selectedVpc.region;
    }

    populateNetworkTargetOptions();
}

function findRouteTableForSubnet(subnetId) {
    return networkRouteTableCache.find(routeTable =>
        (routeTable.associatedSubnets || []).some(association => association.subnetId === subnetId)
    );
}

function getRouteTableCountForVpc(vpcId) {
    return networkRouteTableCache.filter(routeTable => routeTable.vpc?._id === vpcId).length;
}

function renderVPCs(vpcs = []) {
    const container = document.getElementById('vpc-list');
    if (!container) return;

    if (!vpcs.length) {
        container.innerHTML = getNetworkEmptyStateMarkup({
            icon: 'layers',
            title: 'No VPCs yet',
            description: 'Create a VPC to start structuring subnets, routing, and regional traffic isolation.',
            actionLabel: 'Create VPC',
            actionHandler: 'openVPCModal()'
        });
        return;
    }

    container.className = 'network-stack';
    container.innerHTML = vpcs.map(vpc => {
        const publicCount = (vpc.subnets || []).filter(subnet => subnet.type === 'public').length;
        const privateCount = (vpc.subnets || []).filter(subnet => subnet.type === 'private').length;
        const routeTablesForVpc = networkRouteTableCache.filter(routeTable => routeTable.vpc?._id === vpc._id);
        const routeTableCount = routeTablesForVpc.length;
        const subnetMarkup = (vpc.subnets || []).length
            ? vpc.subnets.map(subnet => {
                const routeTable = findRouteTableForSubnet(subnet._id);
                const routeTableLabel = routeTable
                    ? `${routeTable.name}${routeTable.isMain ? ' (main)' : ''}`
                    : 'Unassigned';

                return `
                    <div class="network-list-card network-vpc-subnet-card">
                        <div class="network-list-head">
                            <div style="flex:1;">
                                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                                    <div class="network-list-title">${subnet.name}</div>
                                    <span class="${subnet.type === 'public' ? getNetworkBadgeClass('public') : getNetworkBadgeClass('private')}">${subnet.type}</span>
                                </div>
                                <div class="network-list-meta">${subnet.cidr} | AZ ${String(subnet.availabilityZone || 'a').toUpperCase()}</div>
                                <div class="network-list-note">Route Table: ${routeTableLabel}</div>
                            </div>
                            <button class="network-action-btn network-action-btn--ghost network-action-btn--danger" style="font-size:0.72rem;" onclick="deleteSubnet('${vpc._id}', '${subnet._id}')">Delete</button>
                        </div>
                    </div>
                `;
            }).join('')
            : getNetworkEmptyStateMarkup({
                icon: 'subnets',
                title: 'No subnets configured',
                description: 'Add a public or private subnet to place workloads inside this VPC.',
                actionLabel: 'Add Subnet',
                actionHandler: `openSubnetModal('${vpc._id}')`
            });

        return `
            <div class="network-vpc-card">
                <div class="network-vpc-head">
                    <div style="flex:1;">
                        <div class="network-kicker">Virtual Private Cloud</div>
                        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:6px;">
                            <strong style="font-size:1.08rem;">${vpc.name}</strong>
                            <span class="${getNetworkBadgeClass(vpc.status)}">${String(vpc.status || 'available').toUpperCase()}</span>
                        </div>
                        <div class="network-list-meta">${vpc.cidr} | ${vpc.region}</div>
                    </div>
                    <button class="network-action-btn network-action-btn--ghost network-action-btn--danger" style="font-size:0.75rem;" onclick="deleteVpc('${vpc._id}')">Delete</button>
                </div>
                <div class="network-meta">
                    <div class="network-meta-row">
                        <span class="network-meta-label">CIDR</span>
                        <span class="network-meta-value">${vpc.cidr}</span>
                    </div>
                    <div class="network-meta-row">
                        <span class="network-meta-label">Region</span>
                        <span class="network-meta-value">${vpc.region}</span>
                    </div>
                </div>
                <div class="network-metrics-row">
                    <div class="network-metric">
                        <div class="network-metric-label">Subnets</div>
                        <div class="network-metric-value">${vpc.subnets?.length || 0}</div>
                    </div>
                    <div class="network-metric">
                        <div class="network-metric-label">Public / Private</div>
                        <div class="network-metric-value">${publicCount} / ${privateCount}</div>
                    </div>
                    <div class="network-metric">
                        <div class="network-metric-label">Route Tables</div>
                        <div class="network-metric-value">${routeTableCount}</div>
                    </div>
                </div>
                <div class="network-list">${subnetMarkup}</div>
                <div class="network-action-row">
                    <button class="network-action-btn network-action-btn--primary" style="font-size:0.75rem;" onclick="openSubnetModal('${vpc._id}')">Add Subnet</button>
                    <button class="network-action-btn network-action-btn--secondary" style="font-size:0.75rem;" onclick="openRouteTableModal('${vpc._id}')">Add Route Table</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderRouteTables(routeTables = []) {
    const container = document.getElementById('route-table-list');
    if (!container) return;

    if (!routeTables.length) {
        container.innerHTML = getNetworkEmptyStateMarkup({
            icon: 'routeTable',
            title: 'No route tables yet',
            description: 'Create a route table to define where subnet traffic should flow.',
            actionLabel: 'Add Route Table',
            actionHandler: 'openRouteTableModal()'
        });
        return;
    }

    container.className = 'network-stack';
    container.innerHTML = routeTables.map(routeTable => {
        const routeMarkup = (routeTable.routes || []).map(route => `
            <div class="network-list-card">
                <div class="network-kicker">Destination</div>
                <div class="network-list-title" style="margin-top:4px;">${route.destination}</div>
                <div class="network-list-note">${route.targetType} -> ${route.target}</div>
            </div>
        `).join('');
        const associatedSubnetMarkup = (routeTable.associatedSubnets || []).length
            ? routeTable.associatedSubnets.map(subnet => `
                <span class="${getNetworkBadgeClass('public')}">
                    ${subnet.subnetName}
                </span>
            `).join('')
            : '<span style="font-size:0.84rem; color:#64748b;">No subnets associated.</span>';

        return `
            <div class="network-route-table-card">
                <div class="network-surface-head">
                    <div>
                        <div class="network-kicker">Route Table</div>
                        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:6px;">
                            <strong style="font-size:1.05rem;">${routeTable.name}</strong>
                            <span class="${routeTable.isMain ? getNetworkBadgeClass('main') : getNetworkBadgeClass(routeTable.status)}">
                                ${routeTable.isMain ? 'MAIN' : routeTable.status.toUpperCase()}
                            </span>
                        </div>
                        <div class="network-list-meta">
                            ${(routeTable.vpc?.name || 'Unknown VPC')} | ${(routeTable.vpc?.region || 'N/A')}
                        </div>
                    </div>
                    ${routeTable.isMain
                    ? '<button class="network-action-btn network-action-btn--ghost" style="font-size:0.75rem;" disabled>Main</button>'
                    : `<button class="network-action-btn network-action-btn--ghost network-action-btn--danger" style="font-size:0.75rem;" onclick="deleteRouteTable('${routeTable._id}')">Delete</button>`}
                </div>
                <div class="network-list">${routeMarkup}</div>
                <div class="network-list-card">
                    <div class="network-kicker" style="margin-bottom:8px;">Associated Subnets</div>
                    <div class="network-inline-pills">${associatedSubnetMarkup}</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderLoadBalancers(loadBalancers = []) {
    const container = document.getElementById('lb-list');
    if (!container) return;

    if (!loadBalancers.length) {
        container.innerHTML = getNetworkEmptyStateMarkup({
            icon: 'loadBalancer',
            title: 'No load balancers yet',
            description: 'Route traffic across healthy targets by creating a load balancer for one of your VPCs.',
            actionLabel: 'Create Load Balancer',
            actionHandler: 'openLBModal()'
        });
        return;
    }

    container.className = 'network-stack';
    container.innerHTML = loadBalancers.map(loadBalancer => {
        const targetMarkup = (loadBalancer.targets || []).length
            ? loadBalancer.targets.map(target => `
                <div class="network-list-card">
                    <div class="network-list-head">
                        <div>
                            <div class="network-list-title">${target.instance?.name || 'Detached target'}</div>
                            <div class="network-list-meta">
                                ${(target.instance?.region || 'Unknown region')} | ${(target.instance?.subnetName || 'Unknown subnet')} | ${(target.instance?.privateIp || target.instance?.publicIp || target.instance?.ip || 'IP pending')} | Port ${target.port || loadBalancer.listener?.port || 'N/A'}
                            </div>
                        </div>
                        <span class="${getNetworkBadgeClass(target.healthStatus)}">${String(target.healthStatus || 'unknown').toUpperCase()}</span>
                    </div>
                </div>
            `).join('')
            : getNetworkEmptyStateMarkup({
                icon: 'loadBalancer',
                title: 'No targets attached',
                description: 'Attach running compute instances to begin routing traffic through this load balancer.',
                actionLabel: 'Create Load Balancer',
                actionHandler: 'openLBModal()'
            });

        return `
            <div class="network-load-balancer-card">
                <div class="network-surface-head">
                    <div style="flex: 1;">
                        <div class="network-kicker">Load Balancer</div>
                        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:6px;">
                            <strong style="font-size:1.1rem;">${loadBalancer.name}</strong>
                            <span class="${getNetworkBadgeClass(loadBalancer.status)}">${String(loadBalancer.status || 'available').toUpperCase()}</span>
                        </div>
                        <div class="network-list-meta">${loadBalancer.dnsName || 'DNS pending'}</div>
                        <div class="network-list-note">
                            ${loadBalancer.type} | ${loadBalancer.region} | ${loadBalancer.listener?.protocol || 'HTTP'}:${loadBalancer.listener?.port || 80}
                        </div>
                        <div class="network-list-meta">
                            VPC: ${loadBalancer.vpc?.name || 'Not attached'}
                        </div>
                    </div>
                    <button class="network-action-btn network-action-btn--ghost network-action-btn--danger" style="font-size:0.75rem;" onclick="deleteLB('${loadBalancer._id}')">Delete</button>
                </div>
                <div class="network-metrics-row">
                    <div class="network-metric">
                        <div class="network-metric-label">Healthy Targets</div>
                        <div class="network-metric-value">${loadBalancer.healthyTargetCount || 0}</div>
                    </div>
                    <div class="network-metric">
                        <div class="network-metric-label">Total Targets</div>
                        <div class="network-metric-value">${loadBalancer.totalTargetCount || 0}</div>
                    </div>
                    <div class="network-metric">
                        <div class="network-metric-label">Protocol</div>
                        <div class="network-metric-value">${loadBalancer.listener?.protocol || 'HTTP'}</div>
                    </div>
                </div>
                <div class="network-list">${targetMarkup}</div>
            </div>
        `;
    }).join('');
}

async function loadNetworkResources() {
    const authHeaders = { 'Authorization': `Bearer ${token}` };

    try {
        const res = await fetch(`${API_URL}/network/overview`, {
            headers: authHeaders
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.msg || 'Error loading network resources');
        }

        const vpcs = Array.isArray(data.vpcs) ? data.vpcs : [];
        const routeTables = Array.isArray(data.routeTables) ? data.routeTables : [];
        const loadBalancers = Array.isArray(data.loadBalancers) ? data.loadBalancers : [];
        const instanceTargets = Array.isArray(data.instanceTargets) ? data.instanceTargets : [];

        networkVpcCache = vpcs;
        networkRouteTableCache = routeTables;
        networkLoadBalancerCache = loadBalancers;
        networkInstanceTargetCache = instanceTargets;

        populateNetworkVpcOptions();
        syncVmVpcOptions();
        syncLbRegionWithVpcSelection();
        renderNetworkSummary(data.summary || getNetworkSummaryTotals(vpcs, routeTables, loadBalancers, instanceTargets));
        renderVPCs(vpcs);
        renderRouteTables(routeTables);
        renderLoadBalancers(loadBalancers);
    } catch (err) {
        console.error('Load Network Resources Error:', err);
        showToast(err.message || 'Error loading network resources');
    }
}

function openVPCModal() {
    openModal('vpcModal');
}

function openSubnetModal(vpcId = '') {
    if (!networkVpcCache.length) {
        showToast('Create a VPC first');
        return;
    }

    populateNetworkVpcOptions();
    const select = document.getElementById('subnetVpc');
    if (select && vpcId) {
        select.value = vpcId;
    }

    openModal('subnetModal');
}

function openRouteTableModal(vpcId = '') {
    if (!networkVpcCache.length) {
        showToast('Create a VPC first');
        return;
    }

    populateNetworkVpcOptions();
    const select = document.getElementById('routeTableVpc');
    if (select && vpcId) {
        select.value = vpcId;
    }

    refreshRouteTableSubnetOptions();
    openModal('routeTableModal');
}

function refreshRouteTableSubnetOptions() {
    const container = document.getElementById('routeTableSubnetOptions');
    const selectedVpcId = document.getElementById('routeTableVpc')?.value;
    if (!container) return;

    const vpc = networkVpcCache.find(item => item._id === selectedVpcId);

    if (!vpc) {
        container.innerHTML = '<div style="color:#64748b;">Select a VPC to choose subnets.</div>';
        return;
    }

    if (!(vpc.subnets || []).length) {
        container.innerHTML = '<div style="color:#64748b;">No subnets available in this VPC yet.</div>';
        return;
    }

    container.innerHTML = vpc.subnets.map(subnet => `
        <label style="display:flex; align-items:flex-start; gap:10px; margin:0; cursor:pointer;">
            <input type="checkbox" name="routeTableSubnets" value="${subnet._id}" style="width:auto; margin:0;">
            <span>
                <strong style="color:var(--dark);">${subnet.name}</strong><br>
                <span style="font-size:0.82rem; color:#64748b;">${subnet.cidr} | ${subnet.type} | AZ ${String(subnet.availabilityZone || 'a').toUpperCase()}</span>
            </span>
        </label>
    `).join('');
}

async function createVPC() {
    const name = document.getElementById('vpcName')?.value?.trim();
    const region = document.getElementById('vpcRegion')?.value;
    const cidr = document.getElementById('vpcCidr')?.value?.trim();

    if (!name) {
        showToast('Please enter VPC name');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/network/vpc`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, region, cidr })
        });

        if (res.ok) {
            closeModal('vpcModal');
            const nameInput = document.getElementById('vpcName');
            if (nameInput) nameInput.value = '';
            const cidrInput = document.getElementById('vpcCidr');
            if (cidrInput) cidrInput.value = '10.0.0.0/16';
            await loadNetworkResources();
            showToast('VPC created successfully');
        } else {
            const data = await res.json();
            showToast(data.msg || 'Failed to create VPC');
        }
    } catch (err) {
        console.error('Create VPC Error:', err);
        showToast('Error creating VPC');
    }
}

async function createSubnet() {
    const vpcId = document.getElementById('subnetVpc')?.value;
    const name = document.getElementById('subnetName')?.value?.trim();
    const cidr = document.getElementById('subnetCidr')?.value?.trim();
    const availabilityZone = document.getElementById('subnetAvailabilityZone')?.value;
    const type = document.getElementById('subnetType')?.value;

    if (!vpcId || !name || !cidr) {
        showToast('Choose a VPC and enter subnet name and CIDR');
        return;
    }

    try {
        const subnetRequest = await fetch(`${API_URL}/network/vpc/${vpcId}/subnets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, cidr, availabilityZone, type })
        });

        if (subnetRequest.ok) {
            closeModal('subnetModal');
            document.getElementById('subnetName').value = '';
            document.getElementById('subnetCidr').value = '';
            document.getElementById('subnetAvailabilityZone').value = 'a';
            document.getElementById('subnetType').value = 'public';
            await loadNetworkResources();
            showToast('Subnet created successfully');
        } else {
            const data = await subnetRequest.json().catch(() => ({}));
            showToast(data.msg || 'Failed to create subnet');
        }
    } catch (err) {
        console.error('Create Subnet Error:', err);
        showToast('Error creating subnet');
    }
}

async function createRouteTable() {
    const vpcId = document.getElementById('routeTableVpc')?.value;
    const name = document.getElementById('routeTableName')?.value?.trim();
    const destination = document.getElementById('routeDestination')?.value?.trim();
    const targetType = document.getElementById('routeTargetType')?.value;
    const target = document.getElementById('routeTarget')?.value?.trim();
    const subnetIds = [...document.querySelectorAll('input[name="routeTableSubnets"]:checked')].map(input => input.value);

    if (!vpcId || !name) {
        showToast('Choose a VPC and enter a route table name');
        return;
    }

    if ((destination && !target) || (!destination && target)) {
        showToast('Enter both destination and target for the additional route');
        return;
    }

    const routes = destination && target
        ? [{ destination, target, targetType }]
        : [];

    try {
        const res = await fetch(`${API_URL}/network/routetable`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, vpcId, subnetIds, routes })
        });

        if (res.ok) {
            closeModal('routeTableModal');
            document.getElementById('routeTableName').value = '';
            document.getElementById('routeDestination').value = '';
            document.getElementById('routeTarget').value = '';
            document.getElementById('routeTargetType').value = 'internet-gateway';
            await loadNetworkResources();
            showToast('Route table created successfully');
        } else {
            const data = await res.json().catch(() => ({}));
            showToast(data.msg || 'Failed to create route table');
        }
    } catch (err) {
        console.error('Create Route Table Error:', err);
        showToast('Error creating route table');
    }
}

function openLBModal() {
    if (!networkVpcCache.length) {
        showToast('Create a VPC first');
        return;
    }

    populateNetworkVpcOptions();
    updateLbListenerDefaults();
    syncLbRegionWithVpcSelection();
    openModal('lbModal');
}

async function createLB() {
    const name = document.getElementById('lbName')?.value?.trim();
    const type = document.getElementById('lbType')?.value;
    const region = document.getElementById('lbRegion')?.value;
    const vpcId = document.getElementById('lbVpc')?.value;
    const listenerProtocol = document.getElementById('lbProtocol')?.value;
    const listenerPort = Number.parseInt(document.getElementById('lbPort')?.value, 10);
    const targetInstanceIds = [...document.querySelectorAll('input[name="lbTargetInstances"]:checked')]
        .map(input => input.value);

    if (!name || !vpcId) {
        showToast('Choose a VPC and enter a load balancer name');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/network/loadbalancer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name,
                type,
                region,
                vpcId,
                listenerProtocol,
                listenerPort,
                targetInstanceIds
            })
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.msg || 'Failed to create load balancer');
        }

        closeModal('lbModal');
        document.getElementById('lbName').value = '';
        document.getElementById('lbVpc').selectedIndex = 0;
        document.getElementById('lbType').value = 'application';
        updateLbListenerDefaults();
        [...document.querySelectorAll('input[name="lbTargetInstances"]')].forEach(input => {
            input.checked = false;
        });
        await loadNetworkResources();
        showToast('Load balancer created successfully');
    } catch (err) {
        console.error('Create LB Error:', err);
        showToast(err.message || 'Error creating load balancer');
    }
}

async function loadLBs() {
    return loadNetworkResources();
}

async function loadVPCs() {
    return loadNetworkResources();
}

async function loadRouteTables() {
    return loadNetworkResources();
}

async function deleteVpc(id) {
    if (!confirm('Delete this VPC? Any custom route tables inside it will also be removed.')) return;

    try {
        const res = await fetch(`${API_URL}/network/vpc/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.msg || 'Failed to delete VPC');
        }

        await loadNetworkResources();
        showToast('VPC deleted');
    } catch (err) {
        console.error('Delete VPC Error:', err);
        showToast(err.message || 'Error deleting VPC');
    }
}

async function deleteSubnet(vpcId, subnetId) {
    if (!confirm('Delete this subnet? Route table associations will be updated automatically.')) return;

    try {
        const res = await fetch(`${API_URL}/network/vpc/${vpcId}/subnets/${subnetId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.msg || 'Failed to delete subnet');
        }

        await loadNetworkResources();
        showToast('Subnet deleted');
    } catch (err) {
        console.error('Delete Subnet Error:', err);
        showToast(err.message || 'Error deleting subnet');
    }
}

async function deleteRouteTable(id) {
    if (!confirm('Delete this route table? Its subnet associations will move back to the main route table.')) return;

    try {
        const res = await fetch(`${API_URL}/network/routetable/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.msg || 'Failed to delete route table');
        }

        await loadNetworkResources();
        showToast('Route table deleted');
    } catch (err) {
        console.error('Delete Route Table Error:', err);
        showToast(err.message || 'Error deleting route table');
    }
}

async function deleteLB(id) {
    if (!confirm('Delete this Load Balancer?')) return;

    try {
        const res = await fetch(`${API_URL}/network/loadbalancer/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.msg || 'Failed to delete load balancer');
        }

        await loadNetworkResources();
        showToast('Load balancer deleted');
    } catch (err) {
        console.error('Delete LB Error:', err);
        showToast(err.message || 'Error deleting load balancer');
    }
}

// ============================================
// MONITORING
// ============================================



let autoRefreshInterval = null;
let currentMetrics = [];
let monitoringRequestInFlight = false;

function clearChart() {
    const ctx = document.getElementById('metricsChart');
    if (!ctx || typeof Chart === 'undefined') return;

    const existingChart = Chart.getChart(ctx);
    if (existingChart) {
        existingChart.destroy();
    }

    metricsChart = null;
}

async function handleGoogleCredentialResponse(response) {
    let timeoutId = null;

    try {
        console.log('[GoogleAuth] credential received');
        const controller = new AbortController();
        timeoutId = window.setTimeout(() => controller.abort(), GOOGLE_AUTH_REQUEST_TIMEOUT_MS);

        const res = await fetch(`${API_URL}/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getDeviceHeaders() },
            body: JSON.stringify({ credential: response.credential }),
            signal: controller.signal
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.message || data.msg || 'Google sign-in failed');
        }

        applyAuthenticatedSession(data, 'Signed in with Google');
    } catch (err) {
        console.error('[GoogleAuth] Error:', err);

        if (err.name === 'AbortError') {
            showToast('Google sign-in timed out. Please check the server API and try again.');
            return;
        }

        showToast(err.message || 'Google sign-in failed');
    } finally {
        if (timeoutId) {
            window.clearTimeout(timeoutId);
        }
    }
}

async function initializeGoogleAuth() {
    const loginContainer = document.getElementById('googleLoginButton');
    const registerContainer = document.getElementById('googleRegisterButton');
    if (!loginContainer && !registerContainer) {
        return;
    }

    const availability = await isGoogleAuthAllowedOnCurrentOrigin();
    if (!availability.allowed) {
        renderGoogleAuthMessage(availability.reason);
        return;
    }

    if (googleInitialized || !availability.clientId) {
        return;
    }

    if (!window.google?.accounts?.id) {
        if (googleInitAttempts >= 20) {
            console.warn('[GoogleAuth] Google SDK did not finish loading');
            return;
        }

        googleInitAttempts += 1;
        window.setTimeout(initializeGoogleAuth, 300);
        return;
    }

    google.accounts.id.initialize({
        client_id: availability.clientId,
        callback: handleGoogleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true
    });

    if (loginContainer) {
        loginContainer.innerHTML = '';
        google.accounts.id.renderButton(loginContainer, {
            theme: 'outline',
            size: 'large',
            shape: 'pill',
            text: 'signin_with',
            width: 280
        });
    }

    if (registerContainer) {
        registerContainer.innerHTML = '';
        google.accounts.id.renderButton(registerContainer, {
            theme: 'outline',
            size: 'large',
            shape: 'pill',
            text: 'signup_with',
            width: 280
        });
    }

    googleInitialized = true;
}

async function loadMonitoring() {
    const monitoringPage = document.getElementById('monitoring');
    if (!monitoringPage || !monitoringPage.classList.contains('active')) {
        return;
    }

    if (monitoringRequestInFlight) {
        return;
    }

    monitoringRequestInFlight = true;

    try {
        const res = await fetch(`${API_URL}/monitoring/summary`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Failed to fetch monitoring data');

        const data = await res.json();
        currentMetrics = data;

        // Update instance selector
        updateInstanceSelector(data);

        // Update stats cards
        updateMonitoringStats(data);

        const container = document.getElementById('monitoring-cards');
        container.innerHTML = '';

        if (data.length === 0) {
            container.innerHTML = `
                <div class="card" style="grid-column: 1/-1; text-align: center; padding: 40px;">
                    <h3>No Running Instances</h3>
                    <p style="color: #64748b; margin-top: 10px;">Launch a VM to see monitoring metrics</p>
                    <button class="btn btn-primary" style="margin-top: 20px;" onclick="router('iaas')">Launch Instance</button>
                </div>
            `;
            clearChart();
            return;
        }

        // Display instance cards
        data.forEach(inst => {
            const statusColor = inst.cpu > 80 ? 'var(--danger)' : inst.cpu > 60 ? 'var(--warning)' : 'var(--success)';
            const ramColor = inst.ram > 85 ? 'var(--danger)' : inst.ram > 60 ? 'var(--warning)' : 'var(--success)';

            container.innerHTML += `
                <div class="card" style="border-left: 4px solid ${statusColor};">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                        <div>
                            <h4 style="margin-bottom: 5px;">${inst.name}</h4>
                            <small style="color: #64748b;">${inst.region} | ${inst.id?.slice(-8) || 'N/A'}</small>
                        </div>
                        <span class="badge bg-running">Running</span>
                    </div>
                    
                    <div class="monitor-row">
                        <span class="monitor-label">CPU</span>
                        <div class="progress-bg">
                            <div class="progress-fill" style="width: ${inst.cpu}%; background: ${statusColor};"></div>
                        </div>
                        <span style="font-weight: 600; color: ${statusColor};">${inst.cpu}%</span>
                    </div>
                    
                    <div class="monitor-row">
                        <span class="monitor-label">RAM</span>
                        <div class="progress-bg">
                            <div class="progress-fill" style="width: ${inst.ram}%; background: ${ramColor};"></div>
                        </div>
                        <span style="font-weight: 600; color: ${ramColor};">${inst.ram}%</span>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;">
                        <div>
                            <div style="font-size: 0.75rem; color: #64748b;">Network In</div>
                            <div style="font-weight: 600;">${inst.networkIn} MB/s</div>
                        </div>
                        <div>
                            <div style="font-size: 0.75rem; color: #64748b;">Network Out</div>
                            <div style="font-weight: 600;">${inst.networkOut} MB/s</div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 15px; display: flex; gap: 10px;">
                        <button class="btn btn-outline" style="flex: 1; font-size: 0.85rem;" onclick="viewInstanceDetails('${inst.id}')"> Details</button>
                        <button class="btn btn-outline" style="flex: 1; font-size: 0.85rem;" onclick="setAlertThreshold('${inst.id}')"> Alerts</button>
                    </div>
                </div>
            `;
        });

        // Load historical chart for selected instance or first instance
        const selectedInstance = document.getElementById('instanceSelector')?.value;
        const instanceToMonitor = selectedInstance || data[0].id;
        const instanceName = selectedInstance ?
            data.find(i => i.id === selectedInstance)?.name : data[0].name;

        await loadHistoricalChart(instanceToMonitor, instanceName);

    } catch (err) {
        console.error('Monitoring Error:', err);
        showToast('Error loading monitoring data');
        clearChart();
    } finally {
        monitoringRequestInFlight = false;
    }
}

function updateInstanceSelector(instances) {
    const selector = document.getElementById('instanceSelector');
    if (!selector) return;

    const currentValue = selector.value;
    selector.innerHTML = '<option value="">All Instances</option>';

    instances.forEach(inst => {
        selector.innerHTML += `
            <option value="${inst.id}" ${inst.id === currentValue ? 'selected' : ''}>
                ${inst.name} (${inst.region})
            </option>
        `;
    });
}

function updateMonitoringStats(instances) {
    const totalEl = document.getElementById('monitor-total-instances');
    const runningEl = document.getElementById('monitor-running');
    const avgCpuEl = document.getElementById('monitor-avg-cpu');
    const avgRamEl = document.getElementById('monitor-avg-ram');

    if (totalEl) totalEl.innerText = instances.length;
    if (runningEl) runningEl.innerText = instances.filter(i => i.cpu > 0).length;

    if (instances.length > 0) {
        const avgCpu = Math.round(instances.reduce((sum, i) => sum + i.cpu, 0) / instances.length);
        const avgRam = Math.round(instances.reduce((sum, i) => sum + i.ram, 0) / instances.length);

        if (avgCpuEl) avgCpuEl.innerText = `${avgCpu}%`;
        if (avgRamEl) avgRamEl.innerText = `${avgRam}%`;
    } else {
        if (avgCpuEl) avgCpuEl.innerText = '0%';
        if (avgRamEl) avgRamEl.innerText = '0%';
    }
}

function toggleAutoRefresh() {
    const monitoringPage = document.getElementById('monitoring');
    const interval = document.getElementById('refreshInterval')?.value || '5000';

    // Clear existing interval
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }

    if (!monitoringPage || !monitoringPage.classList.contains('active')) {
        return;
    }

    // Set new interval if not 0
    if (interval !== '0') {
        autoRefreshInterval = setInterval(() => {
            loadMonitoring();
        }, parseInt(interval));
    }
}

function exportMetrics() {
    if (currentMetrics.length === 0) {
        showToast('No metrics to export');
        return;
    }

    const csvContent = [
        ['Instance', 'Region', 'CPU (%)', 'RAM (%)', 'Network In (MB/s)', 'Network Out (MB/s)'].join(','),
        ...currentMetrics.map(m => [
            m.name,
            m.region,
            m.cpu,
            m.ram,
            m.networkIn,
            m.networkOut
        ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `metrics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    showToast('Metrics exported successfully');
}

function toggleMetric(metricType) {
    activeMonitoringMetric = metricType;
    syncMonitoringMetricButtons();
    applyMonitoringMetricVisibility(metricType);
    showToast(`Showing ${metricType.toUpperCase()} metrics`);
}

function syncMonitoringMetricButtons() {
    document.querySelectorAll('[data-metric-filter]').forEach((button) => {
        const isActive = button.getAttribute('data-metric-filter') === activeMonitoringMetric;
        button.classList.toggle('btn-primary', isActive);
        button.classList.toggle('btn-outline', !isActive);
        button.classList.toggle('metric-toggle-active', isActive);
    });
}

function applyMonitoringMetricVisibility(metricType = activeMonitoringMetric) {
    if (!metricsChart) return;

    metricsChart.data.datasets.forEach((dataset) => {
        dataset.hidden = dataset.metricKey !== metricType;
    });

    if (metricsChart.options?.scales?.yNetwork) {
        metricsChart.options.scales.yNetwork.display = metricType === 'network';
    }

    metricsChart.update();
}

function setAlertThreshold(instanceId) {
    const cpuThreshold = prompt('Set CPU alert threshold (%):', '80');
    if (cpuThreshold) {
        const thresholds = JSON.parse(localStorage.getItem('bytesky_alert_thresholds') || '{}');
        thresholds[instanceId] = { cpu: Number(cpuThreshold) };
        localStorage.setItem('bytesky_alert_thresholds', JSON.stringify(thresholds));
        showToast(`Alert set: CPU > ${cpuThreshold}% for instance ${instanceId}`);
    }
}

function parseMonitoringTimestamp(value) {
    const parsedDate = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function formatMonitoringLabel(value, timeRange) {
    const parsedDate = parseMonitoringTimestamp(value);
    if (!parsedDate) {
        return typeof value === 'string' && value.trim() ? value : translate('general.unknownTime');
    }

    const options = timeRange === '7d'
        ? { month: 'short', day: 'numeric' }
        : timeRange === '24h'
            ? { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
            : { hour: '2-digit', minute: '2-digit', hour12: true };

    return formatLocalizedDate(parsedDate, options);
}

function formatMonitoringTooltipLabel(value) {
    const parsedDate = parseMonitoringTimestamp(value);
    if (!parsedDate) {
        return typeof value === 'string' && value.trim() ? value : translate('general.unknownTime');
    }

    return formatLocalizedDate(parsedDate, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
}

async function loadHistoricalChart(instanceId, instanceName) {
    try {
        const timeRange = document.getElementById('timeRange')?.value || '1h';

        const res = await fetch(`${API_URL}/monitoring/history/${instanceId}?period=${timeRange}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) return;

        const historyData = await res.json();
        const ctx = document.getElementById('metricsChart');
        if (!ctx) return;

        // Destroy existing chart
        const existingChart = Chart.getChart(ctx);
        if (existingChart) existingChart.destroy();

        // Aggregate data points if too many (max 100 points for readability)
        const maxDataPoints = 100;
        let labels = historyData.labels || [];
        let cpuData = historyData.cpu || [];
        let ramData = historyData.ram || [];
        let networkInData = historyData.networkIn || [];
        let networkOutData = historyData.networkOut || [];

        if (labels.length > maxDataPoints) {
            const skipFactor = Math.ceil(labels.length / maxDataPoints);
            labels = labels.filter((_, index) => index % skipFactor === 0);
            cpuData = cpuData.filter((_, index) => index % skipFactor === 0);
            ramData = ramData.filter((_, index) => index % skipFactor === 0);
            networkInData = networkInData.filter((_, index) => index % skipFactor === 0);
            networkOutData = networkOutData.filter((_, index) => index % skipFactor === 0);
        }

        // Format labels for better readability
        const formattedLabels = labels.map(label => formatMonitoringLabel(label, timeRange));

        metricsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: formattedLabels,
                datasets: [
                    {
                        label: 'CPU Usage (%)',
                        metricKey: 'cpu',
                        data: cpuData,
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37, 99, 235, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointRadius: 2,
                        pointHoverRadius: 5
                    },
                    {
                        label: 'RAM Usage (%)',
                        metricKey: 'ram',
                        data: ramData,
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointRadius: 2,
                        pointHoverRadius: 5
                    },
                    {
                        label: 'Network In (MB/s)',
                        metricKey: 'network',
                        data: networkInData,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        tension: 0.4,
                        fill: false,
                        pointRadius: 2,
                        pointHoverRadius: 5,
                        yAxisID: 'yNetwork'
                    },
                    {
                        label: 'Network Out (MB/s)',
                        metricKey: 'network',
                        data: networkOutData,
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.15)',
                        tension: 0.4,
                        fill: false,
                        pointRadius: 2,
                        pointHoverRadius: 5,
                        yAxisID: 'yNetwork'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 15
                        }
                    },
                    title: {
                        display: true,
                        text: `Historical Metrics - ${instanceName} (${timeRange})`,
                        font: { size: 16, weight: 'bold' }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            title: function (context) {
                                const dataIndex = context[0]?.dataIndex ?? 0;
                                return formatMonitoringTooltipLabel(labels[dataIndex]);
                            },
                            label: function (context) {
                                const suffix = context.dataset.metricKey === 'network' ? ' MB/s' : '%';
                                return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}${suffix}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Usage (%)',
                            font: { weight: 'bold' }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    yNetwork: {
                        beginAtZero: true,
                        position: 'right',
                        display: false,
                        title: {
                            display: true,
                            text: 'Network (MB/s)',
                            font: { weight: 'bold' }
                        },
                        grid: {
                            drawOnChartArea: false
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: timeRange === '7d' ? 'Date' : 'Time',
                            font: { weight: 'bold' }
                        },
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxTicksLimit: 10,
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                }
            }
        });

        applyMonitoringMetricVisibility(activeMonitoringMetric);
    } catch (err) {
        console.error('Chart Error:', err);
    }
}
// ============================================
// BILLING
// ============================================

async function loadBilling() {
    try {
        const res = await fetch(`${API_URL}/billing`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) return;

        const invoices = await res.json();
        const list = document.getElementById('billing-list');
        const totalEl = document.getElementById('billing-total');
        const statusEl = document.getElementById('billing-payment-status');

        if (!list) return;

        list.innerHTML = '';
        let total = 0;
        let unpaidCount = 0;

        if (invoices.length === 0) {
            list.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 40px; color: #64748b;">
                        No invoices found. Launch an instance to generate invoices.
                    </td>
                </tr>
            `;
        } else {
            invoices.forEach(inv => {
                if (inv.status === 'Unpaid') {
                    total += inv.amount;
                    unpaidCount += 1;
                }
                list.innerHTML += `
                    <tr>
                        <td>${formatLocalizedDateShort(inv.createdAt)}</td>
                        <td>${inv.description}</td>
                        <td>${inv.usageHours ? inv.usageHours.toFixed(2) + ' hrs' : 'N/A'}</td>
                        <td>$${inv.amount.toFixed(2)}</td>
                        <td>
                            <span class="badge ${inv.status === 'Paid' ? 'bg-running' : 'bg-provisioning'}">${inv.status}</span>
                            ${inv.status === 'Unpaid' ? `<button class="btn btn-outline" type="button" style="margin-left:8px; font-size:0.8rem;" onclick="payInvoice('${inv._id}')">Pay</button>` : ''}
                        </td>
                    </tr>
                `;
            });
        }

        if (totalEl) {
            totalEl.innerText = '$' + total.toFixed(2);
        }
        if (statusEl) {
            statusEl.innerText = unpaidCount
                ? `${unpaidCount} unpaid invoice(s) ready for Stripe checkout.`
                : 'All invoices are paid.';
        }
    } catch (err) {
        console.error('Billing Error:', err);
    }
}

async function getStripeClient() {
    if (!window.Stripe) {
        throw new Error('Stripe.js is not loaded');
    }

    if (!stripeClientPromise) {
        stripeClientPromise = Promise.resolve(window.Stripe(STRIPE_PUBLISHABLE_KEY));
    }

    return stripeClientPromise;
}

async function startStripeCheckout(invoiceIds) {
    const payBtn = document.getElementById('billingPayBtn');
    const statusEl = document.getElementById('billing-payment-status');

    try {
        if (payBtn) {
            payBtn.disabled = true;
            payBtn.innerText = 'Redirecting...';
        }
        if (statusEl) {
            statusEl.innerText = 'Creating Stripe checkout session...';
        }

        const res = await fetch(`${API_URL}/billing/checkout-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ invoiceIds })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.msg || data.message || 'Unable to start Stripe checkout');
        }

        if (data.url) {
            window.location.href = data.url;
            return;
        }

        if (data.sessionId) {
            const stripe = await getStripeClient();
            const result = await stripe.redirectToCheckout({ sessionId: data.sessionId });
            if (result.error) {
                throw result.error;
            }
            return;
        }

        throw new Error('Stripe checkout did not return a redirect target');
    } finally {
        if (payBtn) {
            payBtn.disabled = false;
            payBtn.innerText = 'Pay with Stripe';
        }
        if (statusEl) {
            statusEl.innerText = 'Secure checkout powered by Stripe.';
        }
    }
}

async function confirmStripeCheckoutIfNeeded() {
    const params = new URLSearchParams(window.location.search);
    const paymentState = params.get('payment');
    const sessionId = params.get('session_id');
    const targetPage = params.get('page');

    if (!paymentState) {
        return;
    }

    if (paymentState === 'success' && sessionId && token) {
        try {
            const res = await fetch(`${API_URL}/billing/checkout-confirm`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ sessionId })
            });

            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                showToast('Stripe payment confirmed successfully');
                if (targetPage === 'billing') {
                    router('billing');
                }
            } else {
                showToast(data.msg || data.message || 'Unable to confirm Stripe payment');
            }
        } catch (err) {
            console.error('Stripe confirm error:', err);
        }
    } else if (paymentState === 'cancelled') {
        showToast('Stripe checkout was cancelled');
    }

    params.delete('payment');
    params.delete('session_id');
    params.delete('page');
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', nextUrl);
}

async function payBalance() {
    try {
        const res = await fetch(`${API_URL}/billing`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            showToast('Error fetching invoices');
            return;
        }

        const invoices = await res.json();
        const unpaidInvoices = invoices.filter(inv => inv.status === 'Unpaid');

        if (unpaidInvoices.length === 0) {
            showToast('No unpaid invoices');
            return;
        }

        await startStripeCheckout(unpaidInvoices.map(inv => inv._id));
    } catch (err) {
        console.error('Payment Error:', err);
        showToast(err.message || 'Error processing payment');
    }
}

async function payInvoice(invoiceId) {
    try {
        await startStripeCheckout([invoiceId]);
    } catch (err) {
        console.error('Single invoice payment error:', err);
        showToast(err.message || 'Error processing invoice payment');
    }
}

// ============================================
// DASHBOARD (ENHANCED)
// ============================================

let costChart = null;
let resourceChart = null;

async function loadContainerSessions() {
    if (!hasAuthenticatedSession()) {
        renderContainerSessions([]);
        return [];
    }

    try {
        console.log('[VM] Loading active sessions from', `${API_URL}/vm/active`);
        const res = await fetch(`${API_URL}/vm/active`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            renderContainerSessions([]);
            return [];
        }

        const data = await res.json();
        const sessions = Array.isArray(data.vms)
            ? data.vms.map(vm => ({ ...vm, hostPort: vm.port }))
            : [];
        renderContainerSessions(sessions);
        return sessions;
    } catch (err) {
        console.error('Load Container Sessions Error:', err);
        renderContainerSessions([]);
        return [];
    }
}

function renderContainerSessions(sessions) {
    activeContainerSessions = sessions;

    const stateEl = document.getElementById('vmSessionState');
    const listEl = document.getElementById('vmSessionList');
    const stopBtn = document.getElementById('stopVmBtn');

    if (!stateEl || !listEl) return;

    listEl.innerHTML = '';

    if (!sessions.length) {
        stateEl.innerHTML = 'No active browser VM session.';
        if (stopBtn) stopBtn.style.display = 'none';
        return;
    }

    if (stopBtn) stopBtn.style.display = 'inline-flex';

    const nextExpiry = new Date(sessions[0].expiresAt).toLocaleTimeString();
    stateEl.innerHTML = `Active browser VM ready. Auto-cleanup at ${nextExpiry}.`;

    sessions.forEach(session => {
        const openAction = session.url
            ? `<a class="btn btn-primary" href="${session.url}" target="_blank" rel="noopener noreferrer">Open Your VM</a>`
            : '';

        listEl.innerHTML += `
            <div style="border:1px solid #e2e8f0; border-radius:10px; padding:14px; background:white;">
                <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:center;">
                    <div>
                        <div style="font-weight:700; color:#0f172a;">${session.containerName}</div>
                        <div style="color:#64748b; font-size:0.92rem; margin-top:4px;">Container ${session.containerId}</div>
                        <div style="color:#64748b; font-size:0.92rem; margin-top:4px;">Browser-accessible sandbox container with live development tooling</div>
                        <div style="color:#64748b; font-size:0.92rem; margin-top:4px;">${session.hostPort ? `Port ${session.hostPort} • ` : ''}${translate('profile.expires')}: ${formatLocalizedDateTime(session.expiresAt)}</div>
                    </div>
                    <div style="display:flex; gap:10px; flex-wrap:wrap;">
                        ${openAction}
                        <button class="btn btn-outline" onclick="stopBrowserVm('${session.containerId}')">Stop VM</button>
                    </div>
                </div>
            </div>
        `;
    });
}

function setVmLaunchButtonState(isLoading) {
    const btn = document.getElementById('launchVmBtn');
    if (btn) {
        btn.disabled = isLoading;
        btn.innerText = isLoading ? 'Provisioning Sandbox...' : 'Launch VM';
    }
}

function renderVmLaunchResult(session, url) {
    const stateEl = document.getElementById('vmSessionState');
    const listEl = document.getElementById('vmSessionList');

    if (!stateEl || !listEl || !session) return;

    stateEl.innerHTML = `
        Browser VM started successfully.
        ${url ? `<a href="${url}" target="_blank" rel="noopener noreferrer" style="margin-left:8px; font-weight:600;">Open Your VM</a>` : ''}
    `;

    listEl.innerHTML = `
        <div style="border:1px solid #e2e8f0; border-radius:10px; padding:14px; background:white;">
            <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:center;">
                <div>
                    <div style="font-weight:700; color:#0f172a;">${session.containerName || session.containerId}</div>
                    <div style="color:#64748b; font-size:0.92rem; margin-top:4px;">Container ${session.containerId}</div>
                    <div style="color:#64748b; font-size:0.92rem; margin-top:4px;">Node.js sandbox container with browser-ready status page</div>
                    <div style="color:#64748b; font-size:0.92rem; margin-top:4px;">${session.hostPort || session.port ? `Port ${session.hostPort || session.port}` : 'Port pending'}</div>
                    <div style="color:#64748b; font-size:0.92rem; margin-top:4px;">${url || 'URL unavailable'}</div>
                </div>
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    ${url ? `<a class="btn btn-primary" href="${url}" target="_blank" rel="noopener noreferrer">Open Your VM</a>` : ''}
                    <button class="btn btn-outline" type="button" onclick="stopBrowserVm('${session.containerId}')">Stop VM</button>
                </div>
            </div>
        </div>
    `;
}

async function launchVM() {
    console.log('[VM] Launch VM invoked', {
        hasToken: Boolean(token),
        endpoint: `${API_URL}/vm/create`,
        image: 'node:18'
    });

    if (vmLaunchInProgress) {
        console.log('[VM] Launch ignored because another launch is already in progress');
        return;
    }

    if (!token) {
        console.error('[VM] Launch blocked because no auth token is present');
        showToast('Please log in first');
        return;
    }

    vmLaunchInProgress = true;
    setVmLaunchButtonState(true);

    try {
        console.log('[VM] Sending POST request to create VM');
        const res = await fetch(`${API_URL}/vm/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ image: 'node:18' })
        });

        console.log('[VM] Response received', { status: res.status, ok: res.ok });
        const data = await res.json().catch(() => ({}));
        console.log('[VM] Response payload', data);

        if (!res.ok) {
            showToast(data.message || data.msg || 'Unable to launch browser VM');
            return;
        }

        const session = data.vm || {
            containerId: data.containerId,
            containerName: data.containerId,
            hostPort: data.port,
            port: data.port,
            url: data.url
        };
        session.hostPort = session.hostPort || session.port;
        const url = data.accessUrl || data.url || session.url;

        renderVmLaunchResult(session, url);
        showToast('Browser VM launched successfully');
        await loadContainerSessions();

        if (url) {
            window.open(url, '_blank', 'noopener');
        }
    } catch (err) {
        console.error('[VM] Launch Browser VM Error:', err);
        showToast('Unable to reach the VM launch API');
    } finally {
        vmLaunchInProgress = false;
        setVmLaunchButtonState(false);
    }
}

async function launchBrowserVm() {
    return launchVM();
}

async function stopBrowserVm(containerId) {
    const targetContainerId = containerId || activeContainerSessions[0]?.containerId;
    if (!targetContainerId) {
        showToast('No active VM to stop');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/vm/${targetContainerId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await res.json();
        if (!res.ok) {
            showToast(data.message || data.msg || 'Unable to stop VM');
            return;
        }

        showToast('Browser VM stopped');
        await loadContainerSessions();
    } catch (err) {
        console.error('Stop Browser VM Error:', err);
        showToast('Error stopping browser VM');
    }
}

async function loadDashboardData() {
    if (!hasAuthenticatedSession()) {
        renderContainerSessions([]);
        const countEl = document.getElementById('dash-vm-count');
        const storageEl = document.getElementById('dash-storage');
        const spendEl = document.getElementById('dash-spend');
        const lbEl = document.getElementById('dash-loadbalancers');
        if (countEl) countEl.innerText = '0';
        if (storageEl) storageEl.innerText = '0 B';
        if (spendEl) spendEl.innerText = '$0.00';
        if (lbEl) lbEl.innerText = '0';
        return;
    }

    try {
        const authHeaders = { 'Authorization': `Bearer ${token}` };
        const containerSessionsPromise = loadContainerSessions();
        const [vmsResult, storageResult, billingResult, loadBalancerResult] = await Promise.allSettled([
            fetch(`${API_URL}/instances`, { headers: authHeaders }),
            fetch(`${API_URL}/storage`, { headers: authHeaders }),
            fetch(`${API_URL}/billing`, { headers: authHeaders }),
            fetch(`${API_URL}/network/loadbalancer`, { headers: authHeaders })
        ]);

        let vms = [];
        if (vmsResult.status === 'fulfilled' && vmsResult.value.ok) {
            vms = await vmsResult.value.json();
            const countEl = document.getElementById('dash-vm-count');
            if (countEl) countEl.innerText = vms.length;
        }

        let storageTotal = 0;
        if (storageResult.status === 'fulfilled' && storageResult.value.ok) {
            const files = await storageResult.value.json();
            storageTotal = files.reduce((sum, f) => sum + (f.fileSize || 0), 0);
            const storageEl = document.getElementById('dash-storage');
            if (storageEl) storageEl.innerText = formatFileSize(storageTotal);
        }

        if (billingResult.status === 'fulfilled' && billingResult.value.ok) {
            const invoices = await billingResult.value.json();
            const total = invoices.reduce((sum, inv) => sum + inv.amount, 0);
            const spendEl = document.getElementById('dash-spend');
            if (spendEl) spendEl.innerText = '$' + total.toFixed(2);

            createCostChart(invoices);
        }

        if (loadBalancerResult.status === 'fulfilled' && loadBalancerResult.value.ok) {
            const lbs = await loadBalancerResult.value.json();
            const lbEl = document.getElementById('dash-loadbalancers');
            if (lbEl) lbEl.innerText = lbs.length;
        }

        createResourceChart(vms);
        loadRecentActivity(vms, storageTotal);
        await containerSessionsPromise;

    } catch (err) {
        console.error('Dashboard Error:', err);
        showToast('Dashboard could not reach the backend. Check that API server is running on port 5000.');
    }
}

function createCostChart(invoices) {
    const ctx = document.getElementById('costChart');
    if (!ctx) return;

    // Destroy existing chart
    if (costChart) {
        costChart.destroy();
    }

    // Group invoices by date (last 7 days)
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        last7Days.push(formatLocalizedDate(d, { month: 'short', day: 'numeric' }));
    }

    const dailyCosts = last7Days.map(date => {
        return invoices
            .filter(inv => formatLocalizedDate(inv.createdAt, { month: 'short', day: 'numeric' }) === date)
            .reduce((sum, inv) => sum + inv.amount, 0);
    });

    costChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last7Days,
            datasets: [{
                label: 'Daily Cost ($)',
                data: dailyCosts,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function createResourceChart(vms) {
    const ctx = document.getElementById('resourceChart');
    if (!ctx) return;

    // Destroy existing chart
    if (resourceChart) {
        resourceChart.destroy();
    }

    // Calculate resource distribution
    const runningVMs = vms.filter(vm => vm.status === 'running').length;
    const stoppedVMs = vms.filter(vm => vm.status === 'stopped').length;
    const provisioningVMs = vms.filter(vm => vm.status === 'provisioning').length;

    resourceChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Running', 'Stopped', 'Provisioning'],
            datasets: [{
                data: [runningVMs, stoppedVMs, provisioningVMs],
                backgroundColor: [
                    '#10b981',
                    '#64748b',
                    '#f59e0b'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function loadRecentActivity(vms, storageUsed) {
    const activityLog = document.getElementById('activity-log');
    if (!activityLog) return;

    const activities = [];

    // Add VM activities
    vms.slice(0, 5).forEach(vm => {
        activities.push({
            time: formatLocalizedDateTime(vm.createdAt),
            text: `Instance "${vm.name}" ${vm.status}`,
            icon: vm.status === 'running' ? '' : vm.status === 'stopped' ? '' : ''
        });
    });

    // Add storage activity
    if (storageUsed > 0) {
        activities.push({
            time: 'Recently',
            text: `${formatFileSize(storageUsed)} storage used`,
            icon: ''
        });
    }

    // Add billing activity
    activities.push({
        time: 'Recently',
        text: 'Monthly billing cycle active',
        icon: ''
    });

    // Sort by time (most recent first)
    activities.sort((a, b) => new Date(b.time) - new Date(a.time));

    // Display activities
    if (activities.length === 0) {
        activityLog.innerHTML = '<li style="padding: 10px; color: #64748b;">No recent activity</li>';
    } else {
        activityLog.innerHTML = activities.slice(0, 10).map(activity => `
            <li style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.2rem;">${activity.icon}</span>
                <div style="flex: 1;">
                    <div style="font-weight: 500;">${activity.text}</div>
                    <div style="font-size: 0.75rem; color: #64748b;">${activity.time}</div>
                </div>
            </li>
        `).join('');
    }
}

// ============================================
// ADMIN
// ============================================

async function loadAdmin() {
    if (!currentUser || currentUser.role !== 'admin') {
        showToast('Admin access required');
        router('dashboard');
        return;
    }

    try {
        const analyticsRes = await fetch(`${API_URL}/admin/analytics`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (analyticsRes.status === 401 || analyticsRes.status === 403) {
            const msg = await analyticsRes.json().catch(() => ({ msg: 'Admin access required' }));
            showToast(msg.msg || 'Admin access required');
            clearStoredSession();
            updateNav();
            router('login', { skipAuthCheck: true });
            return;
        }

        if (!analyticsRes.ok) {
            showToast('Unable to load admin analytics');
            return;
        }

        if (analyticsRes.ok) {
            const data = await analyticsRes.json();
            document.getElementById('admin-total-users').innerText = data.totalUsers || 0;
            document.getElementById('admin-total-revenue').innerText = '$' + (data.totalRevenue || 0).toFixed(2);
            document.getElementById('admin-active-instances').innerText = data.runningInstances || 0;
            const totalTicketsEl = document.getElementById('admin-total-tickets');
            const openTicketsEl = document.getElementById('admin-open-tickets');
            const progressTicketsEl = document.getElementById('admin-inprogress-tickets');
            const closedTicketsEl = document.getElementById('admin-closed-tickets');
            if (totalTicketsEl) totalTicketsEl.innerText = data.totalTickets || 0;
            if (openTicketsEl) openTicketsEl.innerText = data.openTickets || 0;
            if (progressTicketsEl) progressTicketsEl.innerText = data.inProgressTickets || 0;
            if (closedTicketsEl) closedTicketsEl.innerText = data.closedTickets || 0;

            if (data.revenueByRegion?.length > 0) {
                const ctx = document.getElementById('adminRevenueChart');
                if (ctx) {
                    const existing = Chart.getChart(ctx);
                    if (existing) existing.destroy();
                    new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: data.revenueByRegion.map(r => r._id),
                            datasets: [{
                                label: 'Revenue ($)',
                                data: data.revenueByRegion.map(r => r.total),
                                backgroundColor: '#2563eb'
                            }]
                        },
                        options: { responsive: true }
                    });
                }
            }

            createAdminTicketsChart(data.ticketsPerDay || []);
        }

        const usersRes = await fetch(`${API_URL}/admin/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!usersRes.ok) {
            showToast('Unable to load admin users');
            return;
        }

        if (usersRes.ok) {
            const users = await usersRes.json();
            adminUsersCache = users;
            adminCurrentPage = 1;
            applyAdminUserFilters();
        }

        loadAdminTickets(1);
    } catch (err) {
        console.error('Admin Error:', err);
    }
}

function createAdminTicketsChart(ticketsPerDay) {
    const ctx = document.getElementById('adminTicketsChart');
    if (!ctx) return;
    const existing = Chart.getChart(ctx);
    if (existing) existing.destroy();

    const labels = [];
    const values = [];
    const map = new Map((ticketsPerDay || []).map((x) => [x._id, x.count]));

    for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        labels.push(formatLocalizedDate(d, { month: 'short', day: 'numeric' }));
        values.push(map.get(key) || 0);
    }

    new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Tickets',
                data: values,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37,99,235,0.12)',
                tension: 0.35,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });
}

function debouncedLoadAdminTickets() {
    clearTimeout(adminTicketSearchDebounce);
    adminTicketSearchDebounce = setTimeout(() => loadAdminTickets(1), 300);
}

async function loadAdminTickets(page = 1) {
    try {
        const authToken = getActiveAuthToken();
        if (!authToken) {
            const tbody = document.getElementById('admin-ticket-list');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--danger);">Please sign in to view tickets</td></tr>';
            }
            return;
        }

        adminTicketCurrentPage = page;
        const tbody = document.getElementById('admin-ticket-list');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:#64748b;">Loading tickets...</td></tr>';

        const search = (document.getElementById('admin-ticket-search')?.value || '').trim();
        const status = document.getElementById('admin-ticket-status-filter')?.value || '';
        const priority = document.getElementById('admin-ticket-priority-filter')?.value || '';
        const limit = parseInt(document.getElementById('admin-ticket-limit')?.value || '10', 10);

        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (search) params.append('search', search);
        if (status) params.append('status', status);
        if (priority) params.append('priority', priority);

        const res = await fetch(`${API_URL}/admin/tickets?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!res.ok) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--danger);">Unable to load tickets</td></tr>';
            return;
        }

        const payload = await res.json();
        const tickets = payload.data || [];
        const pagination = payload.pagination || { page, limit, total: 0, totalPages: 1 };
        adminTicketTotalPages = pagination.totalPages || 1;

        if (tickets.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:#64748b;">No tickets found</td></tr>';
            updateAdminTicketPagination(pagination.total || 0, pagination.page || 1, pagination.limit || limit, adminTicketTotalPages);
            return;
        }

        tbody.innerHTML = '';
        tickets.forEach((t) => {
            const assigneeOptions = [
                '<option value="">Unassigned</option>',
                ...adminUsersCache.map((u) => `<option value="${u._id}" ${(t.assignedTo?._id === u._id) ? 'selected' : ''}>${u.name}</option>`)
            ].join('');

            tbody.innerHTML += `
                <tr class="ticket-row-hover">
                    <td>${t._id?.slice(-6) || 'N/A'}</td>
                    <td>${t.subject || 'N/A'}</td>
                    <td>
                        <span class="ticket-status-badge ${getTicketStatusClass(t.status)}">${formatTicketStatusLabel(t.status)}</span>
                        <select style="margin-top:6px;" onchange="updateAdminTicket('${t._id}', { status: this.value })">
                            <option value="open" ${t.status === 'open' ? 'selected' : ''}>Open</option>
                            <option value="in-progress" ${t.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                            <option value="closed" ${(t.status === 'closed' || t.status === 'resolved') ? 'selected' : ''}>Closed</option>
                        </select>
                    </td>
                    <td>
                        <span class="ticket-priority-badge ${getTicketPriorityClass(t.priority)}">${(t.priority || 'medium').toUpperCase()}</span>
                        <select style="margin-top:6px;" onchange="updateAdminTicket('${t._id}', { priority: this.value })">
                            <option value="low" ${t.priority === 'low' ? 'selected' : ''}>Low</option>
                            <option value="medium" ${t.priority === 'medium' ? 'selected' : ''}>Medium</option>
                            <option value="high" ${t.priority === 'high' ? 'selected' : ''}>High</option>
                        </select>
                    </td>
                    <td>
                        <select onchange="updateAdminTicket('${t._id}', { assignedTo: this.value })">
                            ${assigneeOptions}
                        </select>
                    </td>
                    <td>${formatTicketDate(t.createdAt)}</td>
                    <td>${formatTicketDate(t.updatedAt)}</td>
                    <td><button class="btn btn-danger" style="font-size:0.75rem;" onclick="deleteAdminTicket('${t._id}')">Delete</button></td>
                </tr>
            `;
        });

        updateAdminTicketPagination(pagination.total || 0, pagination.page || page, pagination.limit || limit, adminTicketTotalPages);
    } catch (err) {
        console.error('Load Admin Tickets Error:', err);
    }
}

function getTicketStatusClass(status) {
    const s = (status || 'open').toLowerCase();
    if (s === 'in-progress') return 'ticket-status-in-progress';
    if (s === 'closed' || s === 'resolved') return 'ticket-status-closed';
    return 'ticket-status-open';
}

function formatTicketStatusLabel(status) {
    const s = (status || 'open').toLowerCase();
    if (s === 'in-progress') return 'In Progress';
    if (s === 'resolved') return 'Closed';
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function getTicketPriorityClass(priority) {
    const p = (priority || 'medium').toLowerCase();
    if (p === 'high') return 'ticket-priority-high';
    if (p === 'low') return 'ticket-priority-low';
    return 'ticket-priority-medium';
}

function updateAdminTicketPagination(total, page, limit, totalPages) {
    const info = document.getElementById('admin-ticket-page-info');
    const prevBtn = document.getElementById('admin-ticket-prev-page');
    const nextBtn = document.getElementById('admin-ticket-next-page');
    const start = total === 0 ? 0 : (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);
    if (info) info.innerText = `Showing ${start}-${end} of ${total} tickets`;
    if (prevBtn) prevBtn.disabled = page <= 1;
    if (nextBtn) nextBtn.disabled = page >= totalPages;
}

function changeAdminTicketPage(step) {
    const next = adminTicketCurrentPage + step;
    if (next < 1 || next > adminTicketTotalPages) return;
    loadAdminTickets(next);
}

async function updateAdminTicket(ticketId, updates) {
    try {
        if (updates.status === 'closed') updates.status = 'closed';
        const res = await fetch(`${API_URL}/admin/tickets/${ticketId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updates)
        });
        if (!res.ok) {
            const data = await res.json();
            showToast(data.msg || 'Failed to update ticket');
            loadAdminTickets(adminTicketCurrentPage);
            return;
        }
        showToast('Ticket updated');
        loadAdminTickets(adminTicketCurrentPage);
        loadAdmin();
    } catch (err) {
        showToast('Error updating ticket');
    }
}

async function deleteAdminTicket(ticketId) {
    if (!confirm('Delete this ticket permanently?')) return;
    try {
        const res = await fetch(`${API_URL}/admin/tickets/${ticketId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            const data = await res.json();
            showToast(data.msg || 'Failed to delete ticket');
            return;
        }
        showToast('Ticket deleted');
        loadAdminTickets(adminTicketCurrentPage);
        loadAdmin();
    } catch (err) {
        showToast('Error deleting ticket');
    }
}

function applyAdminUserFilters() {
    const search = (document.getElementById('admin-user-search')?.value || '').toLowerCase().trim();
    const role = (document.getElementById('admin-role-filter')?.value || '').toLowerCase();
    const twoFA = (document.getElementById('admin-2fa-filter')?.value || '').toLowerCase();

    filteredAdminUsers = adminUsersCache.filter(user => {
        const matchesSearch = !search ||
            (user.name || '').toLowerCase().includes(search) ||
            (user.email || '').toLowerCase().includes(search);
        const matchesRole = !role || (user.role || '').toLowerCase() === role;
        const matchesTwoFA = !twoFA ||
            (twoFA === 'enabled' && user.twoFAEnabled) ||
            (twoFA === 'disabled' && !user.twoFAEnabled);
        return matchesSearch && matchesRole && matchesTwoFA;
    });

    adminCurrentPage = 1;
    renderAdminUsersPage();
}

function renderAdminUsersPage() {
    const list = document.getElementById('admin-user-list');
    if (!list) return;

    list.innerHTML = '';

    if (filteredAdminUsers.length === 0) {
        list.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; color:#64748b; padding:26px;">
                    No users match current filters.
                </td>
            </tr>
        `;
        updateAdminPaginationControls();
        return;
    }

    const startIndex = (adminCurrentPage - 1) * adminUsersPerPage;
    const pagedUsers = filteredAdminUsers.slice(startIndex, startIndex + adminUsersPerPage);

    pagedUsers.forEach(u => {
        const roleBadgeClass = getRoleBadgeClass(u.role);
        const twoFAClass = u.twoFAEnabled ? 'iam-security-enabled' : 'iam-security-disabled';
        list.innerHTML += `
            <tr>
                <td><strong>${u.name || 'N/A'}</strong></td>
                <td>${u.email || 'N/A'}</td>
                <td>
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        <span class="${roleBadgeClass}">${(u.role || 'user').toUpperCase()}</span>
                        <select onchange="updateAdminUserRole('${u._id}', this.value)" style="padding: 5px; border-radius: 4px; border: 1px solid #cbd5e1;">
                            <option value="user" ${(u.role || '').toLowerCase() === 'user' ? 'selected' : ''}>User</option>
                            <option value="developer" ${(u.role || '').toLowerCase() === 'developer' ? 'selected' : ''}>Developer</option>
                            <option value="viewer" ${(u.role || '').toLowerCase() === 'viewer' ? 'selected' : ''}>Viewer</option>
                            <option value="admin" ${(u.role || '').toLowerCase() === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    </div>
                </td>
                <td><span class="iam-security-badge ${twoFAClass}">${u.twoFAEnabled ? 'Enabled' : 'Disabled'}</span></td>
                <td>
                    ${(u.role || '').toLowerCase() !== 'admin' ? `
                    <div class="admin-row-menu">
                        <button class="admin-row-menu-btn" onclick="toggleAdminRowMenu(event, '${u._id}')">Actions</button>
                        <div class="admin-row-menu-list" id="admin-menu-${u._id}">
                            <button onclick="banUser('${u._id}')">Delete User</button>
                        </div>
                    </div>
                    ` : '<span style="color:#64748b; font-size:0.8rem;">Protected</span>'}
                </td>
            </tr>
        `;
    });

    updateAdminPaginationControls();
}

function updateAdminPaginationControls() {
    const total = filteredAdminUsers.length;
    const totalPages = Math.max(1, Math.ceil(total / adminUsersPerPage));
    const info = document.getElementById('admin-page-info');
    const prevBtn = document.getElementById('admin-prev-page');
    const nextBtn = document.getElementById('admin-next-page');

    if (adminCurrentPage > totalPages) adminCurrentPage = totalPages;

    const start = total === 0 ? 0 : (adminCurrentPage - 1) * adminUsersPerPage + 1;
    const end = Math.min(adminCurrentPage * adminUsersPerPage, total);

    if (info) info.innerText = `Showing ${start}-${end} of ${total} users`;
    if (prevBtn) prevBtn.disabled = adminCurrentPage <= 1;
    if (nextBtn) nextBtn.disabled = adminCurrentPage >= totalPages;
}

function changeAdminPage(step) {
    const totalPages = Math.max(1, Math.ceil(filteredAdminUsers.length / adminUsersPerPage));
    const nextPage = adminCurrentPage + step;
    if (nextPage < 1 || nextPage > totalPages) return;
    adminCurrentPage = nextPage;
    renderAdminUsersPage();
}

function toggleAdminRowMenu(event, userId) {
    event.stopPropagation();
    const targetMenuId = `admin-menu-${userId}`;
    document.querySelectorAll('.admin-row-menu-list').forEach(menu => {
        if (menu.id === targetMenuId) {
            menu.classList.toggle('show');
        } else {
            menu.classList.remove('show');
        }
    });
}

document.addEventListener('click', () => {
    document.querySelectorAll('.admin-row-menu-list').forEach(menu => menu.classList.remove('show'));
    document.querySelectorAll('.instance-action-menu-list').forEach(menu => menu.classList.remove('show'));
    closeStorageShareMenus();
});

async function updateAdminUserRole(userId, newRole) {
    try {
        const res = await fetch(`${API_URL}/admin/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ role: newRole })
        });

        if (res.ok) {
            showToast(`User role updated to ${newRole}`);
            loadAdmin();
        } else {
            const data = await res.json();
            showToast(data.msg || 'Failed to update role');
        }
    } catch (err) {
        showToast('Error updating role');
    }
}

async function banUser(id) {
    if (!confirm('Ban this user? All resources will be deleted.')) return;

    try {
        await fetch(`${API_URL}/admin/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        showToast('User banned');
        loadAdmin();
    } catch (err) {
        showToast('Error banning user');
    }
}

// ============================================
// STORAGE (FULLY FIXED)
// ============================================

let storageBuckets = [];
let selectedFiles = [];

function openUploadModal() {
    loadBucketsForUpload();
    openModal('uploadModal');
    setupDragDrop();
}

function setupDragDrop() {
    const dropZone = document.getElementById('dropZone');
    if (!dropZone) return;

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        handleFiles(files);
    });
}

function handleFileSelect(event) {
    const files = event.target.files;
    handleFiles(files);
}

function handleFiles(files) {
    const fileList = document.getElementById('uploadFileList');
    if (!fileList) return;

    fileList.innerHTML = '';
    selectedFiles = Array.from(files);

    selectedFiles.forEach(file => {
        fileList.innerHTML += `
            <div class="upload-progress-item">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 600;">${file.name}</span>
                    <span style="color: #64748b; font-size: 0.85rem;">${formatFileSize(file.size)}</span>
                </div>
                <div class="upload-progress-bar">
                    <div class="upload-progress-fill" style="width: 0%;" id="progress-${file.name.replace(/[^a-zA-Z0-9]/g, '')}"></div>
                </div>
            </div>
        `;
    });
}

async function loadBucketsForUpload() {
    try {
        console.log(' Loading buckets for upload...');

        const res = await fetch(`${API_URL}/storage/buckets`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            console.error('Failed to load buckets:', res.status);
            return;
        }

        storageBuckets = await res.json();
        console.log(' Loaded buckets:', storageBuckets.length);

        // Update upload bucket dropdown
        const uploadBucket = document.getElementById('uploadBucket');
        if (uploadBucket) {
            if (storageBuckets.length === 0) {
                uploadBucket.innerHTML = '<option value="">No buckets - Create one first!</option>';
            } else {
                uploadBucket.innerHTML = storageBuckets.map(b =>
                    `<option value="${b.name}">${b.name} (${b.region})</option>`
                ).join('');
            }
        }

        // Update filter bucket dropdown
        updateBucketFilter();

    } catch (err) {
        console.error('Load Buckets Error:', err);
    }
}

function updateBucketFilter() {
    const select = document.getElementById('filterBucket');
    if (!select) return;

    select.innerHTML = '<option value="all">All Buckets</option>' +
        storageBuckets.map(b => `<option value="${b.name}">${b.name}</option>`).join('');
}

async function uploadFiles() {
    const bucket = document.getElementById('uploadBucket')?.value;

    if (selectedFiles.length === 0) {
        showToast('Please select files to upload');  //  Fixed
        return;
    }

    if (!bucket) {
        showToast('Please select a bucket');  //  Fixed
        return;
    }

    document.getElementById('uploadProgress').style.display = 'block';
    let uploadedCount = 0;

    for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const progressEl = document.getElementById(`progress-${file.name.replace(/[^a-zA-Z0-9]/g, '')}`);
        try {
            if (progressEl) progressEl.style.width = '25%';

            const formData = new FormData();
            formData.append('bucket', bucket);
            formData.append('file', file);

            const res = await fetch(`${API_URL}/storage/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.msg || 'Upload failed');
            }

            if (progressEl) progressEl.style.width = '100%';
            uploadedCount += 1;
        } catch (err) {
            console.error('Upload error:', err);
            if (progressEl) progressEl.style.width = '0%';
            showToast(err.message || `Failed to upload ${file.name}`);
        }
    }

    if (uploadedCount > 0) {
        showToast(`${uploadedCount} file(s) uploaded successfully`);
    }
    closeModal('uploadModal');
    loadStorage();
    loadBucketsForUpload();
    selectedFiles = [];
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = '';
}

async function loadStorage() {
    try {
        console.log(' Loading storage files...');

        const res = await fetch(`${API_URL}/storage`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            console.error('Failed to load storage:', res.status);
            return;
        }

        allStorageFiles = await res.json();
        selectedStorageIds = selectedStorageIds.filter(id => allStorageFiles.some(file => file._id === id));
        console.log(' Loaded files:', allStorageFiles.length);

        filterStorage();
        updateStorageStats();
        updateStorageBulkActions();

    } catch (err) {
        console.error('Storage Error:', err);
    }
}

function getFilteredStorageFiles() {
    const searchTerm = document.getElementById('storageSearch')?.value.toLowerCase() || '';
    const bucketFilter = document.getElementById('filterBucket')?.value || 'all';
    const typeFilter = document.getElementById('filterType')?.value || 'all';

    let filtered = [...allStorageFiles];

    if (searchTerm) {
        filtered = filtered.filter(f => f.fileName.toLowerCase().includes(searchTerm));
    }

    if (bucketFilter !== 'all') {
        filtered = filtered.filter(f => f.bucket === bucketFilter);
    }

    if (typeFilter !== 'all') {
        filtered = filtered.filter(f => getFileType(f.fileName) === typeFilter);
    }

    return filtered;
}

function filterStorage() {
    renderStorage(getFilteredStorageFiles());
}

function renderStorage(files) {
    const tbody = document.getElementById('storage-list');
    const grid = document.getElementById('storage-grid');
    const emptyState = document.getElementById('storageEmpty');

    if (!tbody) return;

    tbody.innerHTML = '';
    if (grid) grid.innerHTML = '';

    if (files.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    files.forEach(f => {
        const fileType = getFileType(f.fileName);
        const fileIcon = getFileIcon(fileType);
        const isSelected = selectedStorageIds.includes(f._id);

        tbody.innerHTML += `
            <tr>
                <td>
                    <input type="checkbox" class="storage-checkbox" value="${f._id}" onchange="toggleStorageSelection('${f._id}')" ${isSelected ? 'checked' : ''}>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 1.5rem;">${fileIcon}</span>
                        <div>
                            <div style="font-weight: 600;">${f.fileName}</div>
                            <div style="font-size: 0.75rem; color: #64748b;">${f._id?.slice(-8) || 'N/A'}</div>
                        </div>
                    </div>
                </td>
                <td><span class="bucket-badge">${f.bucket}</span></td>
                <td>${formatFileSize(f.fileSize)}</td>
                <td>${fileType}</td>
                <td>${formatLocalizedDateShort(f.createdAt)}</td>
                <td>
                    ${renderStorageActions(f, { compact: true })}
                </td>
            </tr>
        `;

        if (grid) {
            grid.innerHTML += `
                <div class="storage-grid-item">
                    <input type="checkbox" value="${f._id}" onchange="toggleStorageSelection('${f._id}')" ${isSelected ? 'checked' : ''}>
                    <div class="storage-grid-icon">${fileIcon}</div>
                    <div class="storage-grid-name">${f.fileName}</div>
                    <div class="storage-grid-size">${formatFileSize(f.fileSize)} • ${f.bucket}</div>
                    <div style="margin-top: 15px; display:flex; justify-content:center;">
                        ${renderStorageActions(f)}
                    </div>
                </div>
            `;
        }
    });

    const selectAllStorage = document.getElementById('selectAllStorage');
    if (selectAllStorage) {
        selectAllStorage.checked = files.length > 0 && files.every(file => selectedStorageIds.includes(file._id));
    }

    updateStorageBulkActions();
}

function getStorageActionIcon(icon) {
    const icons = {
        preview: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4c3.66 0 6.72 2.16 8.27 5.3a1.6 1.6 0 0 1 0 1.4C16.72 13.84 13.66 16 10 16s-6.72-2.16-8.27-5.3a1.6 1.6 0 0 1 0-1.4C3.28 6.16 6.34 4 10 4Zm0 1.5c-2.94 0-5.43 1.68-6.82 4.5 1.39 2.82 3.88 4.5 6.82 4.5s5.43-1.68 6.82-4.5c-1.39-2.82-3.88-4.5-6.82-4.5Zm0 1.75a2.75 2.75 0 1 1 0 5.5 2.75 2.75 0 0 1 0-5.5Z"/></svg>',
        download: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.75a.75.75 0 0 1 .75.75v6.69l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 1 1 1.06-1.06l2.22 2.22V3.5A.75.75 0 0 1 10 2.75ZM4.5 13.75a.75.75 0 0 1 .75.75v.75c0 .138.112.25.25.25h9a.25.25 0 0 0 .25-.25v-.75a.75.75 0 0 1 1.5 0v.75A1.75 1.75 0 0 1 14.5 17h-9A1.75 1.75 0 0 1 3.75 15.25v-.75a.75.75 0 0 1 .75-.75Z"/></svg>',
        share: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.25 4a2.75 2.75 0 1 1 .95 2.08l-4.14 2.4a2.76 2.76 0 0 1 0 3.04l4.14 2.4A2.75 2.75 0 1 1 12.25 15a2.8 2.8 0 0 1 .07-.62l-4.22-2.45a2.75 2.75 0 1 1 0-3.86l4.22-2.45A2.8 2.8 0 0 1 12.25 4Z"/></svg>',
        whatsapp: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3a7 7 0 0 0-5.94 10.7L3 17l3.43-.99A7 7 0 1 0 10 3Zm0 12.5a5.48 5.48 0 0 1-2.8-.77l-.2-.12-2.04.59.62-1.98-.13-.2A5.5 5.5 0 1 1 10 15.5Zm3.15-4.16c-.17-.08-1.03-.51-1.2-.56-.16-.06-.28-.08-.4.08s-.45.56-.55.68c-.1.11-.2.13-.37.05-.17-.08-.72-.26-1.37-.83a5.17 5.17 0 0 1-.95-1.18c-.1-.17-.01-.27.07-.35.07-.07.17-.2.25-.3.08-.1.1-.17.16-.29.05-.11.03-.21-.01-.29-.05-.08-.4-.97-.55-1.34-.14-.33-.28-.29-.39-.29h-.33c-.11 0-.29.04-.44.21-.15.17-.57.56-.57 1.37 0 .81.59 1.6.67 1.71.08.11 1.16 1.77 2.8 2.49.39.17.69.27.92.34.39.12.74.1 1.02.06.31-.05 1.03-.42 1.18-.82.15-.4.15-.74.1-.82-.04-.08-.16-.12-.33-.21Z"/></svg>',
        copy: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.75 2A1.75 1.75 0 0 0 5 3.75v7.5C5 12.216 5.784 13 6.75 13h7.5A1.75 1.75 0 0 0 16 11.25v-7.5A1.75 1.75 0 0 0 14.25 2h-7.5Zm-.25 1.75c0-.138.112-.25.25-.25h7.5c.138 0 .25.112.25.25v7.5a.25.25 0 0 1-.25.25h-7.5a.25.25 0 0 1-.25-.25v-7.5ZM3.75 6A.75.75 0 0 1 4.5 6.75v8.5c0 .138.112.25.25.25h8.5a.75.75 0 0 1 0 1.5h-8.5A1.75 1.75 0 0 1 3 15.25v-8.5A.75.75 0 0 1 3.75 6Z"/></svg>',
        email: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.75 4A1.75 1.75 0 0 0 2 5.75v8.5C2 15.216 2.784 16 3.75 16h12.5A1.75 1.75 0 0 0 18 14.25v-8.5A1.75 1.75 0 0 0 16.25 4H3.75Zm0 1.5h12.5a.25.25 0 0 1 .25.25v.38l-6.1 4.06a.75.75 0 0 1-.83 0L3.5 6.13v-.38a.25.25 0 0 1 .25-.25Zm-.25 2.44 5.27 3.5a2.25 2.25 0 0 0 2.46 0l5.27-3.5v6.31a.25.25 0 0 1-.25.25H3.75a.25.25 0 0 1-.25-.25V7.94Z"/></svg>',
        delete: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8.75 3.5A1.75 1.75 0 0 1 10.5 1.75h1A1.75 1.75 0 0 1 13.25 3.5V4H16a.75.75 0 0 1 0 1.5h-.56l-.72 9.02A2 2 0 0 1 12.73 16.5H7.27a2 2 0 0 1-1.99-1.98L4.56 5.5H4a.75.75 0 0 1 0-1.5h2.75v-.5ZM9.5 4h3v-.5a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25V4Zm-1 3a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0v-5A.75.75 0 0 1 8.5 7Zm3 0a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0v-5A.75.75 0 0 1 11.5 7Z"/></svg>',
        more: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm4.5 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm4.5 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z"/></svg>'
    };

    return icons[icon] || icons.more;
}

function renderStorageActionButton({ label, icon, action, variant = 'neutral', type = 'button' }) {
    return `
        <button class="storage-action-btn ${variant === 'danger' ? 'storage-action-btn--danger' : ''}" type="${type}" onclick="${action}" title="${label}" aria-label="${label}">
            <span class="storage-action-btn__icon">${getStorageActionIcon(icon)}</span>
            <span>${label}</span>
        </button>
    `;
}

function renderStorageActions(file, options = {}) {
    const { compact = false } = options;
    const downloadAction = compact ? `downloadFile('${file._id}')` : `downloadFile('${file._id}', { silent: true })`;

    return `
        <div class="storage-actions ${compact ? 'storage-actions--compact' : ''}">
            ${renderStorageActionButton({ label: 'Preview', icon: 'preview', action: `previewFile('${file._id}')` })}
            ${renderStorageActionButton({ label: 'Download', icon: 'download', action: downloadAction })}
            <div class="storage-share-menu">
                <button class="storage-action-btn" type="button" onclick="toggleStorageShareMenu(event, '${file._id}')" title="Share" aria-label="Share">
                    <span class="storage-action-btn__icon">${getStorageActionIcon('share')}</span>
                    <span>Share</span>
                </button>
                <div class="storage-share-menu-list" id="storage-share-${file._id}">
                    <button type="button" onclick="shareFileToWhatsApp('${file._id}')">
                        <span class="storage-action-btn__icon">${getStorageActionIcon('whatsapp')}</span>
                        <span>WhatsApp</span>
                    </button>
                    <button type="button" onclick="handleCopyLink('${file._id}')">
                        <span class="storage-action-btn__icon">${getStorageActionIcon('copy')}</span>
                        <span>Copy Link</span>
                    </button>
                    <button type="button" onclick="shareFileByEmail('${file._id}')">
                        <span class="storage-action-btn__icon">${getStorageActionIcon('email')}</span>
                        <span>Email</span>
                    </button>
                </div>
            </div>
            ${compact ? renderStorageActionButton({ label: 'Delete', icon: 'delete', action: `deleteFile('${file._id}')`, variant: 'danger' }) : ''}
        </div>
    `;
}

function updateStorageStats() {
    const totalSize = allStorageFiles.reduce((sum, f) => sum + (f.fileSize || 0), 0);
    const totalFiles = allStorageFiles.length;
    const totalBuckets = storageBuckets.length;
    const storageLimit = 5 * 1024 * 1024 * 1024; // 5GB limit
    const usagePercent = ((totalSize / storageLimit) * 100).toFixed(1);

    const totalEl = document.getElementById('storage-total');
    const filesEl = document.getElementById('storage-files');
    const bucketsEl = document.getElementById('storage-buckets');
    const usedEl = document.getElementById('storage-used');

    if (totalEl) totalEl.innerText = formatFileSize(totalSize);
    if (filesEl) filesEl.innerText = totalFiles;
    if (bucketsEl) bucketsEl.innerText = totalBuckets;
    if (usedEl) usedEl.innerText = usagePercent + '%';
}

function getFileType(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'];
    const docExts = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'csv', 'json', 'md', 'xml', 'xls', 'xlsx', 'ppt', 'pptx'];
    const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv'];
    const audioExts = ['mp3', 'wav', 'ogg', 'flac'];
    const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz'];

    if (imageExts.includes(ext)) return 'image';
    if (docExts.includes(ext)) return 'document';
    if (videoExts.includes(ext)) return 'video';
    if (audioExts.includes(ext)) return 'audio';
    if (archiveExts.includes(ext)) return 'archive';
    return 'other';
}

function getFileIcon(type) {
    const icons = {
        'image': 'IMG',
        'document': 'DOC',
        'video': 'VID',
        'audio': 'AUD',
        'archive': 'ZIP',
        'other': 'FILE'
    };
    return icons[type] || '';
}

function getFileExtension(fileName = '') {
    const parts = String(fileName).toLowerCase().split('.');
    return parts.length > 1 ? parts.pop() : '';
}

function isPdfPreview(file) {
    return getFileExtension(file.fileName) === 'pdf' || file.fileType === 'application/pdf';
}

function isTextPreview(file) {
    const ext = getFileExtension(file.fileName);
    const textExts = ['txt', 'csv', 'json', 'md', 'xml', 'html', 'css', 'js', 'ts', 'jsx', 'tsx', 'log', 'yml', 'yaml'];
    const mime = String(file.fileType || '').toLowerCase();
    return textExts.includes(ext) || mime.startsWith('text/') || mime.includes('json') || mime.includes('xml');
}

function isOfficePreview(file) {
    return ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(getFileExtension(file.fileName));
}

function isExternalOfficePreviewAvailable(fileUrl) {
    try {
        const url = new URL(fileUrl);
        return url.protocol === 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname);
    } catch {
        return false;
    }
}

function renderPreviewFallback(file, message = 'Preview is not available for this file type yet.') {
    const safeName = escapeHtml(file.fileName);
    const fileType = getFileType(file.fileName);
    return `
        <div class="preview-fallback preview-fallback--document">
            <div class="preview-fallback-icon">${getFileIcon(fileType)}</div>
            <div>
                <h4>${safeName}</h4>
                <p>${escapeHtml(message)}</p>
            </div>
            <div class="preview-fallback-actions">
                <button class="btn btn-primary" type="button" onclick="downloadFile('${file._id}')">Download</button>
                <a class="btn btn-outline" href="${getStorageFileUrl(file._id)}" target="_blank" rel="noopener">Open in new tab</a>
            </div>
        </div>
    `;
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// File Operations
async function previewFile(fileId) {
    const file = allStorageFiles.find(f => f._id === fileId);
    if (!file) return;

    const content = document.getElementById('previewContent');
    const metadata = document.getElementById('previewMetadata');
    const fileType = getFileType(file.fileName);

    if (!content) return;

    document.getElementById('previewFileName').innerText = file.fileName;
    const fileUrl = getStorageFileUrl(fileId);
    const safeFileName = escapeHtml(file.fileName);
    content.innerHTML = `
        <div class="preview-loading">
            <div class="preview-loading-spinner"></div>
            <p>Preparing preview...</p>
        </div>
    `;

    if (fileType === 'image') {
        content.innerHTML = `<img src="${fileUrl}" alt="${safeFileName}" class="preview-image" onerror="this.parentElement.innerHTML='&lt;div class=&quot;preview-fallback&quot;&gt;&lt;div class=&quot;preview-fallback-icon&quot;&gt;IMG&lt;/div&gt;&lt;p&gt;No preview available&lt;/p&gt;&lt;/div&gt;'">`;
    } else if (isPdfPreview(file)) {
        content.innerHTML = `
            <div class="document-preview-shell">
                <div class="document-preview-toolbar">
                    <span>PDF Preview</span>
                    <a href="${fileUrl}" target="_blank" rel="noopener">Open full screen</a>
                </div>
                <iframe class="document-preview-frame" src="${fileUrl}" title="${safeFileName}"></iframe>
            </div>
        `;
    } else if (isTextPreview(file)) {
        const maxInlinePreviewSize = 1024 * 1024;
        if ((file.fileSize || 0) > maxInlinePreviewSize) {
            content.innerHTML = renderPreviewFallback(file, 'This document is too large for inline preview. Download it to view the full content.');
        } else {
            try {
                const res = await fetch(fileUrl);
                if (!res.ok) throw new Error('Unable to load document preview');
                const text = await res.text();
                content.innerHTML = `
                    <div class="document-preview-shell">
                        <div class="document-preview-toolbar">
                            <span>Document Preview</span>
                            <a href="${fileUrl}" target="_blank" rel="noopener">Open raw file</a>
                        </div>
                        <pre class="text-document-preview">${escapeHtml(text)}</pre>
                    </div>
                `;
            } catch (err) {
                console.error('Document preview error:', err);
                content.innerHTML = renderPreviewFallback(file, 'Could not load this document preview. You can still download or open it in a new tab.');
            }
        }
    } else if (isOfficePreview(file) && isExternalOfficePreviewAvailable(fileUrl)) {
        const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
        content.innerHTML = `
            <div class="document-preview-shell">
                <div class="document-preview-toolbar">
                    <span>Office Document Preview</span>
                    <a href="${fileUrl}" target="_blank" rel="noopener">Open original</a>
                </div>
                <iframe class="document-preview-frame" src="${officeViewerUrl}" title="${safeFileName}"></iframe>
            </div>
        `;
    } else if (fileType === 'video') {
        content.innerHTML = `<video src="${fileUrl}" controls playsinline></video>`;
    } else if (fileType === 'audio') {
        content.innerHTML = `<audio class="audio-preview" src="${fileUrl}" controls></audio>`;
    } else {
        content.innerHTML = renderPreviewFallback(file);
    }

    if (metadata) {
        metadata.innerHTML = `
            <div class="metadata-grid">
                <div class="metadata-item">
                    <div class="metadata-label">File Name</div>
                    <div class="metadata-value">${file.fileName}</div>
                </div>
                <div class="metadata-item">
                    <div class="metadata-label">Size</div>
                    <div class="metadata-value">${formatFileSize(file.fileSize)}</div>
                </div>
                <div class="metadata-item">
                    <div class="metadata-label">Bucket</div>
                    <div class="metadata-value">${file.bucket}</div>
                </div>
                <div class="metadata-item">
                    <div class="metadata-label">Type</div>
                    <div class="metadata-value">${fileType}</div>
                </div>
                <div class="metadata-item">
                    <div class="metadata-label">Content Type</div>
                    <div class="metadata-value">${file.fileType || 'Unknown'}</div>
                </div>
            </div>
        `;
    }

    openModal('filePreviewModal');
}

function getStorageFileUrl(fileId) {
    return new URL(`/api/storage/share/${fileId}`, API_URL).href;
}

async function downloadFile(fileId, options = {}) {
    const { silent = false } = options;
    const file = allStorageFiles.find(f => f._id === fileId);
    if (!file) return;

    if (!silent) {
        showToast(`Downloading ${file.fileName}...`);
    }

    try {
        const res = await fetch(`${API_URL}/storage/${fileId}/download`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const blob = await res.blob();
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = file.fileName;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(link.href);
        } else {
            const data = await res.json().catch(() => ({}));
            showToast(data.msg || 'Download failed');
        }
    } catch (err) {
        console.error('Download error:', err);
    }
}

function getStorageShareMessage(file) {
    const fileUrl = getStorageFileUrl(file._id);
    return {
        fileUrl,
        shareMessage: `Item: ${file.fileName}\nFile: ${fileUrl}`
    };
}

function toggleStorageShareMenu(event, fileId) {
    event.stopPropagation();
    const targetId = `storage-share-${fileId}`;
    document.querySelectorAll('.storage-share-menu-list').forEach((menu) => {
        if (menu.id === targetId) {
            menu.classList.toggle('show');
        } else {
            menu.classList.remove('show');
        }
    });
}

function shareFileToWhatsApp(fileId) {
    const file = allStorageFiles.find(f => f._id === fileId);
    if (!file) return;

    const { shareMessage } = getStorageShareMessage(file);
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
    const whatsappTab = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    closeStorageShareMenus();

    if (!whatsappTab) {
        showToast('Please allow pop-ups to open WhatsApp');
    }
}

async function handleCopyLink(fileId) {
    const file = allStorageFiles.find(f => f._id === fileId);
    if (!file) return;

    try {
        await navigator.clipboard.writeText(getStorageFileUrl(fileId));
        showToast('Link copied!');
    } catch (_error) {
        alert('Link copied!');
    } finally {
        closeStorageShareMenus();
    }
}

function shareFileByEmail(fileId) {
    const file = allStorageFiles.find(f => f._id === fileId);
    if (!file) return;

    const { fileUrl } = getStorageShareMessage(file);
    window.location.href = `mailto:?subject=${encodeURIComponent(`Shared file: ${file.fileName}`)}&body=${encodeURIComponent(`Here is the file link:\n${fileUrl}`)}`;
    closeStorageShareMenus();
}

function closeStorageShareMenus() {
    document.querySelectorAll('.storage-share-menu-list').forEach((menu) => menu.classList.remove('show'));
}

async function deleteFile(id, options = {}) {
    const { skipConfirm = false, silent = false } = options;

    if (!skipConfirm && !confirm('Delete this file? This cannot be undone.')) return;

    try {
        await fetch(`${API_URL}/storage/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!silent) {
            showToast('File deleted');
        }

        selectedStorageIds = selectedStorageIds.filter(fileId => fileId !== id);
        await loadStorage();
    } catch (err) {
        showToast('Error deleting file');
    }
}

// Bucket Management
function openCreateBucketModal() {
    openModal('createBucketModal');
}

async function createBucket(e) {
    if (e) e.preventDefault();

    const name = document.getElementById('bucketName')?.value;
    const region = document.getElementById('bucketRegion')?.value;
    const storageClass = document.getElementById('bucketStorageClass')?.value;
    const versioning = document.getElementById('bucketVersioning')?.checked;
    const isPublic = document.getElementById('bucketPublic')?.checked;

    if (!name) {
        if (typeof showToast !== 'undefined') {
            showToast('Please enter bucket name');
        } else {
            alert('Please enter bucket name');
        }
        return;
    }

    try {
        console.log(' Creating bucket:', { name, region });

        const res = await fetch(`${API_URL}/storage/buckets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, region, storageClass, versioning, isPublic })
        });

        const data = await res.json();

        if (res.ok) {
            if (typeof showToast !== 'undefined') {
                showToast('Bucket created successfully');
            }
            closeModal('createBucketModal');
            document.getElementById('bucketName').value = '';
            loadBucketsForUpload();
            loadStorage();
        } else {
            if (typeof showToast !== 'undefined') {
                showToast(data.msg || 'Failed to create bucket');
            }
        }
    } catch (err) {
        console.error('Create Bucket Error:', err);
        if (typeof showToast !== 'undefined') {
            showToast('Error creating bucket - Make sure backend is running');
        }
    }
}
function resetStorageFilters() {
    const search = document.getElementById('storageSearch');
    const bucket = document.getElementById('filterBucket');
    const type = document.getElementById('filterType');

    if (search) search.value = '';
    if (bucket) bucket.value = 'all';
    if (type) type.value = 'all';

    filterStorage();
}

function toggleStorageSelection(fileId) {
    if (selectedStorageIds.includes(fileId)) {
        selectedStorageIds = selectedStorageIds.filter(id => id !== fileId);
    } else {
        selectedStorageIds.push(fileId);
    }

    updateStorageBulkActions();
    filterStorage();
}

function toggleSelectAllStorage() {
    const selectAll = document.getElementById('selectAllStorage');
    const filteredFiles = getFilteredStorageFiles();
    if (!selectAll) return;

    if (selectAll.checked) {
        const filteredIds = filteredFiles.map(file => file._id);
        selectedStorageIds = Array.from(new Set([...selectedStorageIds, ...filteredIds]));
    } else {
        const filteredIds = new Set(filteredFiles.map(file => file._id));
        selectedStorageIds = selectedStorageIds.filter(id => !filteredIds.has(id));
    }

    updateStorageBulkActions();
    filterStorage();
}

function updateStorageBulkActions() {
    const bulkBar = document.getElementById('storageBulkActions');
    const countLabel = document.getElementById('storageSelectedCount');
    if (!bulkBar || !countLabel) return;

    if (selectedStorageIds.length > 0) {
        bulkBar.style.display = 'block';
        countLabel.innerText = `${selectedStorageIds.length} file${selectedStorageIds.length > 1 ? 's' : ''} selected`;
    } else {
        bulkBar.style.display = 'none';
    }
}

function closeStorageBulkActions() {
    selectedStorageIds = [];
    const selectAll = document.getElementById('selectAllStorage');
    if (selectAll) {
        selectAll.checked = false;
    }

    updateStorageBulkActions();
    filterStorage();
}

async function bulkDownload() {
    if (selectedStorageIds.length === 0) {
        showToast('Select files first');
        return;
    }

    const selectedFilesForDownload = [...selectedStorageIds];
    for (const fileId of selectedFilesForDownload) {
        await downloadFile(fileId, { silent: true });
    }

    showToast(`Started download for ${selectedFilesForDownload.length} file${selectedFilesForDownload.length > 1 ? 's' : ''}`);
}

async function bulkDelete() {
    if (selectedStorageIds.length === 0) {
        showToast('Select files first');
        return;
    }

    if (!confirm(`Delete ${selectedStorageIds.length} selected file(s)? This cannot be undone.`)) return;

    const selectedFilesForDelete = [...selectedStorageIds];
    for (const fileId of selectedFilesForDelete) {
        await deleteFile(fileId, { skipConfirm: true, silent: true });
    }

    selectedStorageIds = [];
    updateStorageBulkActions();
    showToast(`${selectedFilesForDelete.length} file${selectedFilesForDelete.length > 1 ? 's' : ''} deleted`);
}

function toggleStorageView(view) {
    storageView = view;
    const listView = document.getElementById('storageListView');
    const gridView = document.getElementById('storageGridView');

    if (listView) listView.style.display = view === 'list' ? 'block' : 'none';
    if (gridView) gridView.style.display = view === 'grid' ? 'block' : 'none';
    filterStorage();
}

// ============================================
// SUPPORT
// ============================================

function openTicketModal() {
    const attachmentEl = document.getElementById('ticketAttachments');
    if (attachmentEl) attachmentEl.value = '';
    openModal('ticketModal');
}

function formatTicketDate(value) {
    if (!value) return translate('general.unknown');
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return translate('general.unknown');
    return formatLocalizedDateTime(d, translate('general.unknown'));
}

function ticketStatusBadge(status) {
    const s = (status || 'open').toLowerCase();
    const cls = s === 'in-progress' ? 'ticket-status-in-progress' :
        (s === 'closed' || s === 'resolved') ? 'ticket-status-closed' : 'ticket-status-open';
    const label = s === 'in-progress' ? 'In Progress' : (s === 'resolved' ? 'Closed' : s.charAt(0).toUpperCase() + s.slice(1));
    return `<span class="ticket-status-badge ${cls}">${label}</span>`;
}

function ticketPriorityBadge(priority) {
    const p = (priority || 'medium').toLowerCase();
    const cls = p === 'high' ? 'ticket-priority-high' :
        p === 'low' ? 'ticket-priority-low' : 'ticket-priority-medium';
    return `<span class="ticket-priority-badge ${cls}">${p}</span>`;
}

function debouncedLoadTickets() {
    clearTimeout(ticketSearchDebounce);
    ticketSearchDebounce = setTimeout(() => loadTickets(1), 300);
}

async function loadTicketSummary() {
    try {
        const authToken = getActiveAuthToken();
        if (!authToken) {
            return;
        }

        const res = await fetch(`${API_URL}/tickets/summary`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok || !contentType.includes('application/json')) throw new Error('Summary endpoint unavailable');

        const data = await res.json();
        const totalEl = document.getElementById('support-total-tickets');
        const openEl = document.getElementById('support-open-tickets');
        const progressEl = document.getElementById('support-inprogress-tickets');
        const closedEl = document.getElementById('support-closed-tickets');

        if (totalEl) totalEl.innerText = data.total || 0;
        if (openEl) openEl.innerText = data.open || 0;
        if (progressEl) progressEl.innerText = data.inProgress || 0;
        if (closedEl) closedEl.innerText = data.closed || 0;
    } catch (err) {
        try {
            const legacyRes = await fetch(`${API_URL}/support`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!legacyRes.ok) return;
            const legacyData = await legacyRes.json();
            showToast('Running in compatibility mode. Restart backend to enable advanced ticket APIs.');
            const total = legacyData.length;
            const open = legacyData.filter(t => (t.status || 'open') === 'open').length;
            const inProgress = legacyData.filter(t => (t.status || 'open') === 'in-progress').length;
            const closed = legacyData.filter(t => ['closed', 'resolved'].includes((t.status || '').toLowerCase())).length;

            const totalEl = document.getElementById('support-total-tickets');
            const openEl = document.getElementById('support-open-tickets');
            const progressEl = document.getElementById('support-inprogress-tickets');
            const closedEl = document.getElementById('support-closed-tickets');

            if (totalEl) totalEl.innerText = total;
            if (openEl) openEl.innerText = open;
            if (progressEl) progressEl.innerText = inProgress;
            if (closedEl) closedEl.innerText = closed;
        } catch (_legacyErr) {
            console.error('Ticket summary error:', err);
        }
    }
}

function renderTicketPagination(total, page, limit, totalPages) {
    const pageInfo = document.getElementById('ticket-page-info');
    const prevBtn = document.getElementById('ticket-prev-page');
    const nextBtn = document.getElementById('ticket-next-page');
    const start = total === 0 ? 0 : (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);

    if (pageInfo) pageInfo.innerText = `Showing ${start}-${end} of ${total} tickets`;
    if (prevBtn) prevBtn.disabled = page <= 1;
    if (nextBtn) nextBtn.disabled = page >= totalPages;
}

async function loadTickets(page = 1) {
    try {
        const authToken = getActiveAuthToken();
        if (!authToken) {
            const tbody = document.getElementById('ticket-list');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--danger);">Please sign in to view tickets</td></tr>';
            }
            return;
        }

        ticketCurrentPage = page;
        const tbody = document.getElementById('ticket-list');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:#64748b;">Loading tickets...</td></tr>';
        }

        const search = (document.getElementById('ticket-search')?.value || '').trim();
        const status = document.getElementById('ticket-status-filter')?.value || '';
        const priority = document.getElementById('ticket-priority-filter')?.value || '';
        const limit = parseInt(document.getElementById('ticket-limit')?.value || '10', 10);

        const params = new URLSearchParams({
            page: String(page),
            limit: String(limit)
        });
        if (search) params.append('search', search);
        if (status) params.append('status', status);
        if (priority) params.append('priority', priority);

        const res = await fetch(`${API_URL}/tickets?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const contentType = res.headers.get('content-type') || '';
        let tickets = [];
        let pagination = {};

        if (res.ok && contentType.includes('application/json')) {
            const payload = await res.json();
            tickets = payload.data || [];
            pagination = payload.pagination || {};
        } else {
            const legacyRes = await fetch(`${API_URL}/support`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (!legacyRes.ok) {
                if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--danger);">Unable to load tickets</td></tr>';
                return;
            }
            const legacyData = await legacyRes.json();
            const filtered = legacyData.filter((t) => {
                const idTail = (t._id || '').toString();
                const subjectMatch = (t.subject || '').toLowerCase().includes(search.toLowerCase());
                const idMatch = idTail.toLowerCase().includes(search.toLowerCase());
                const statusMatch = !status || (t.status || '').toLowerCase() === status.toLowerCase();
                const priorityMatch = !priority || (t.priority || '').toLowerCase() === priority.toLowerCase();
                const searchMatch = !search || subjectMatch || idMatch;
                return searchMatch && statusMatch && priorityMatch;
            });

            const total = filtered.length;
            const totalPages = Math.max(Math.ceil(total / limit), 1);
            const start = (page - 1) * limit;
            tickets = filtered.slice(start, start + limit);
            pagination = { total, page, limit, totalPages };
        }
        if (!tbody) return;

        tbody.innerHTML = '';

        if (tickets.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8">
                        <div class="ticket-empty-state">
                            <strong>No tickets found.</strong><br>
                            Create a new ticket or adjust your filters.
                        </div>
                    </td>
                </tr>
            `;
            renderTicketPagination(0, 1, limit, 1);
            ticketTotalPages = 1;
            return;
        }

        tickets.forEach((t) => {
            tbody.innerHTML += `
                <tr class="ticket-row-hover">
                    <td>${t._id?.slice(-6) || 'N/A'}</td>
                    <td>${t.subject}</td>
                    <td>${ticketPriorityBadge(t.priority)}</td>
                    <td>${ticketStatusBadge(t.status)}</td>
                    <td>${t.assignedTo?.name || 'Unassigned'}</td>
                    <td>${formatTicketDate(t.createdAt)}</td>
                    <td>${formatTicketDate(t.updatedAt)}</td>
                    <td>
                        <div class="ticket-action-menu">
                            <button class="ticket-action-menu-btn" onclick="toggleTicketActionMenu(event, '${t._id}')">Actions</button>
                            <div class="ticket-action-menu-list" id="ticket-action-${t._id}">
                                <button onclick="viewTicket('${t._id}')">View Ticket</button>
                                <button onclick="editTicket('${t._id}')">Edit Ticket</button>
                                <button onclick="closeTicket('${t._id}')">Close Ticket</button>
                                ${currentUser?.role === 'admin' ? `<button class="danger" onclick="deleteTicket('${t._id}')">Delete Ticket</button>` : ''}
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        });

        ticketTotalPages = pagination.totalPages || 1;
        renderTicketPagination(pagination.total || tickets.length, pagination.page || page, pagination.limit || limit, ticketTotalPages);
        loadTicketSummary();
    } catch (err) {
        const tbody = document.getElementById('ticket-list');
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--danger);">Unable to load tickets</td></tr>';
        console.error('Tickets Error:', err);
    }
}

function changeTicketPage(step) {
    const next = ticketCurrentPage + step;
    if (next < 1 || next > ticketTotalPages) return;
    loadTickets(next);
}

async function createTicket() {
    const subject = document.getElementById('ticketSubject')?.value;
    const description = document.getElementById('ticketDesc')?.value;
    const priority = document.getElementById('ticketPriority')?.value;
    const attachments = document.getElementById('ticketAttachments')?.files || [];

    if (!subject || !description) {
        showToast('Enter subject and description');
        return;
    }

    try {
        const form = new FormData();
        form.append('subject', subject);
        form.append('description', description);
        form.append('priority', priority || 'medium');
        Array.from(attachments).forEach((file) => form.append('attachments', file));

        const res = await fetch(`${API_URL}/tickets`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: form
        });

        if (!res.ok) {
            const data = await res.json();
            showToast(data.msg || 'Error creating ticket');
            return;
        }

        showToast('Ticket created');
        document.getElementById('ticketSubject').value = '';
        document.getElementById('ticketDesc').value = '';
        document.getElementById('ticketPriority').value = 'medium';
        const attachmentsEl = document.getElementById('ticketAttachments');
        if (attachmentsEl) attachmentsEl.value = '';
        closeModal('ticketModal');
        loadTickets(1);
        loadTicketSummary();
    } catch (err) {
        showToast('Error creating ticket');
    }
}

async function viewTicket(id) {
    currentTicketId = id;

    try {
        let ticket = null;
        const res = await fetch(`${API_URL}/tickets/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const contentType = res.headers.get('content-type') || '';

        if (res.ok && contentType.includes('application/json')) {
            ticket = await res.json();
        } else {
            const legacyRes = await fetch(`${API_URL}/support`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!legacyRes.ok) return;
            const legacyTickets = await legacyRes.json();
            ticket = legacyTickets.find((t) => t._id === id);
            if (!ticket) return;
        }
        const panel = document.getElementById('ticket-detail-panel');
        const subjectEl = document.getElementById('ticket-detail-subject');
        const metaEl = document.getElementById('ticket-detail-meta');
        const descEl = document.getElementById('ticket-detail-description');
        const chatEl = document.getElementById('ticket-conversation');
        const historyEl = document.getElementById('ticket-history-list');

        if (!panel || !subjectEl || !metaEl || !descEl || !chatEl || !historyEl) return;

        panel.style.display = 'block';
        subjectEl.innerText = ticket.subject;
        metaEl.innerHTML = `
            Ticket #${ticket._id?.slice(-6) || 'N/A'} |
            ${ticketPriorityBadge(ticket.priority)} ${ticketStatusBadge(ticket.status)} |
            Assigned: ${ticket.assignedTo?.name || 'Unassigned'} |
            Created: ${formatTicketDate(ticket.createdAt)} |
            Updated: ${formatTicketDate(ticket.updatedAt)}
        `;
        descEl.innerText = ticket.description || '';

        chatEl.innerHTML = '';
        (ticket.messages || []).forEach((m) => {
            const isSelf = m.from?._id === currentUser?.id;
            const attachments = (m.attachments || []).map((a) =>
                `<li><a href="${a.url || '#'}" target="_blank" rel="noopener noreferrer">${a.originalName}</a> (${Math.ceil((a.size || 0) / 1024)} KB)</li>`
            ).join('');
            chatEl.innerHTML += `
                <div class="ticket-chat-msg ${isSelf ? 'self' : ''}">
                    <div class="ticket-chat-meta">${m.from?.name || 'Unknown'}  ${formatTicketDate(m.createdAt)}</div>
                    <div>${m.text || m.message || ''}</div>
                    ${attachments ? `<ul style="margin-top:8px; padding-left:18px;">${attachments}</ul>` : ''}
                </div>
            `;
        });

        historyEl.innerHTML = '';
        (ticket.history || []).slice().reverse().forEach((h) => {
            historyEl.innerHTML += `
                <div class="ticket-history-item">
                    <div style="font-weight:600;">${h.action}</div>
                    <div style="color:#64748b; font-size:0.82rem;">${h.actor?.name || 'System'}  ${formatTicketDate(h.createdAt)}</div>
                    ${h.field ? `<div style="font-size:0.82rem; margin-top:4px;">${h.field}: "${h.oldValue || '-'}"  "${h.newValue || '-'}"</div>` : ''}
                </div>
            `;
        });
    } catch (err) {
        console.error('View Ticket Error:', err);
    }
}

async function sendReply() {
    const message = document.getElementById('ticketReply')?.value;
    const files = document.getElementById('ticketReplyAttachments')?.files || [];

    if (!message || !currentTicketId) {
        showToast('Enter reply message');
        return;
    }

    try {
        const form = new FormData();
        form.append('message', message);
        Array.from(files).forEach((file) => form.append('attachments', file));

        let res = await fetch(`${API_URL}/tickets/${currentTicketId}/replies`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: form
        });

        if (!res.ok) {
            const legacyRes = await fetch(`${API_URL}/support/${currentTicketId}/reply`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ message })
            });
            if (!legacyRes.ok) {
                const data = await legacyRes.json().catch(() => ({ msg: 'Error sending reply' }));
                showToast(data.msg || 'Error sending reply');
                return;
            }
        }

        showToast('Reply sent');
        document.getElementById('ticketReply').value = '';
        const replyAttachmentsEl = document.getElementById('ticketReplyAttachments');
        if (replyAttachmentsEl) replyAttachmentsEl.value = '';
        viewTicket(currentTicketId);
        loadTickets(ticketCurrentPage);
        loadTicketSummary();
    } catch (err) {
        showToast('Error sending reply');
    }
}

function closeTicketDetail() {
    const panel = document.getElementById('ticket-detail-panel');
    if (panel) panel.style.display = 'none';
    currentTicketId = null;
}

function toggleTicketActionMenu(event, id) {
    event.stopPropagation();
    const targetId = `ticket-action-${id}`;
    document.querySelectorAll('.ticket-action-menu-list').forEach((menu) => {
        if (menu.id === targetId) {
            menu.classList.toggle('show');
        } else {
            menu.classList.remove('show');
        }
    });
}

document.addEventListener('click', () => {
    document.querySelectorAll('.ticket-action-menu-list').forEach((menu) => menu.classList.remove('show'));
});

async function editTicket(id) {
    try {
        const res = await fetch(`${API_URL}/tickets/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const ticket = await res.json();

        const subject = prompt('Update subject:', ticket.subject || '');
        if (!subject) return;
        const description = prompt('Update description:', ticket.description || '');
        if (!description) return;
        const priority = prompt('Priority (low, medium, high):', ticket.priority || 'medium');
        if (!priority) return;

        const updateRes = await fetch(`${API_URL}/tickets/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ subject, description, priority: priority.toLowerCase() })
        });

        if (!updateRes.ok) {
            const data = await updateRes.json();
            showToast(data.msg || 'Unable to update ticket');
            return;
        }

        showToast('Ticket updated');
        loadTickets(ticketCurrentPage);
        if (currentTicketId === id) viewTicket(id);
    } catch (err) {
        showToast('Error updating ticket');
    }
}

async function closeTicket(id) {
    if (!confirm('Close this ticket?')) return;

    try {
        const res = await fetch(`${API_URL}/tickets/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: 'closed' })
        });

        if (!res.ok) {
            const data = await res.json();
            showToast(data.msg || 'Unable to close ticket');
            return;
        }

        showToast('Ticket closed');
        loadTickets(ticketCurrentPage);
        loadTicketSummary();
        if (currentTicketId === id) viewTicket(id);
    } catch (err) {
        showToast('Error closing ticket');
    }
}

async function deleteTicket(id) {
    if (currentUser?.role !== 'admin') {
        showToast('Only admins can delete tickets');
        return;
    }

    if (!confirm('Delete this ticket permanently?')) return;

    try {
        const res = await fetch(`${API_URL}/tickets/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const data = await res.json();
            showToast(data.msg || 'Unable to delete ticket');
            return;
        }

        showToast('Ticket deleted');
        if (currentTicketId === id) closeTicketDetail();
        loadTickets(ticketCurrentPage);
        loadTicketSummary();
    } catch (err) {
        showToast('Error deleting ticket');
    }
}

// ============================================
// IAM FUNCTIONS
// ============================================

let currentIAMTab = 'api-keys';
let adminUsersCache = [];
let filteredAdminUsers = [];
let adminCurrentPage = 1;
const adminUsersPerPage = 8;

function showIAMTab(tabName) {
    console.log(' Switching IAM tab to:', tabName);

    // Hide all tabs
    document.querySelectorAll('.iam-tab').forEach(tab => {
        if (tab) tab.style.display = 'none';
    });

    // Show selected tab
    const selectedTab = document.getElementById(`iam-${tabName}`);
    if (selectedTab) {
        selectedTab.style.display = 'block';
    }

    // Update active button
    document.querySelectorAll('.iam-tabs .btn').forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline');
    });
    const activeBtn = document.getElementById(`tab-${tabName}`);
    if (activeBtn) {
        activeBtn.classList.remove('btn-outline');
        activeBtn.classList.add('btn-primary');
    }

    currentIAMTab = tabName;

    // Load data for tab
    if (tabName === 'policies') loadIAMPolicies();
    if (tabName === 'api-keys') loadIAMAPIKeys();
    if (tabName === 'audit') loadAuditLogs();
    if (tabName === '2fa') load2FAStatus();

    // Keep tab counters fresh for quick overview
    refreshIAMTabCounts();
}

async function refreshIAMTabCounts() {
    const [policiesResult, apiKeysResult] = await Promise.allSettled([
        fetch(`${API_URL}/iam/policies`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/iam/api-keys`, { headers: { 'Authorization': `Bearer ${token}` } })
    ]);

    if (policiesResult.status === 'fulfilled' && policiesResult.value.ok) {
        const policies = await policiesResult.value.json();
        const policyCount = document.getElementById('tab-count-policies');
        if (policyCount) policyCount.innerText = String(policies.length);
    }

    if (apiKeysResult.status === 'fulfilled' && apiKeysResult.value.ok) {
        const apiKeys = await apiKeysResult.value.json();
        const apiKeyCount = document.getElementById('tab-count-api-keys');
        if (apiKeyCount) apiKeyCount.innerText = String(apiKeys.length);
    }
}

function getRoleBadgeClass(role) {
    const r = (role || 'user').toLowerCase();
    if (r === 'admin') return 'iam-role-badge iam-role-admin';
    if (r === 'developer') return 'iam-role-badge iam-role-developer';
    if (r === 'viewer') return 'iam-role-badge iam-role-viewer';
    return 'iam-role-badge iam-role-user';
}

async function loadIAMPolicies() {
    try {
        const res = await fetch(`${API_URL}/iam/policies`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            showToast(data.msg || 'Unable to load policies');
            return;
        }

        const policies = await res.json();
        const policyCount = document.getElementById('tab-count-policies');
        if (policyCount) policyCount.innerText = String(policies.length);
        const container = document.getElementById('iam-policies-list');
        if (!container) return;

        container.innerHTML = '';

        if (policies.length === 0) {
            container.innerHTML = '<p style="color: #64748b; padding: 20px;">No policies found. Create one to get started.</p>';
            return;
        }

        policies.forEach(policy => {
            container.innerHTML += `
                <div class="card" style="margin-bottom: 15px; padding: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: start; gap: 12px; flex-wrap: wrap;">
                        <div style="flex: 1;">
                            <strong style="font-size: 1.1rem;">${policy.name}</strong>
                            <p style="color: #64748b; margin: 5px 0;">${policy.description || 'Keycloak realm role'}</p>
                            <small style="color: #94a3b8;">
                                Source: Keycloak
                                ${policy.composite ? ' | Composite Role' : ''}
                                ${policy.clientRole ? ' | Client Role' : ''}
                            </small>
                        </div>
                        <div style="display: flex; gap: 5px;">
                            <button class="btn btn-danger" style="font-size: 0.7rem;" onclick="deletePolicy('${encodeURIComponent(policy.name)}')">Delete</button>
                        </div>
                    </div>
                </div>
            `;
        });
    } catch (err) {
        console.error('Load Policies Error:', err);
        showToast('Unable to load policies. Keycloak may not be running or reachable.');
    }
}

async function openCreatePolicyModal() {
    const name = prompt('Enter Keycloak role name:');
    if (!name) return;

    try {
        const res = await fetch(`${API_URL}/iam/policies`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name: name.trim() })
        });

        if (res.ok) {
            showToast('Policy created');
            await loadIAMPolicies();
            await refreshIAMTabCounts();
        } else {
            const data = await res.json().catch(() => ({}));
            showToast(data.msg || 'Failed to create policy');
        }
    } catch (err) {
        showToast('Error creating policy');
    }
}

async function editPolicy(policyId) {
    showToast('Rename is not enabled yet for Keycloak-backed policies');
}

async function deletePolicy(policyId) {
    if (!confirm('Delete this policy?')) return;

    try {
        const res = await fetch(`${API_URL}/iam/policies/${policyId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            showToast('Policy deleted');
            await loadIAMPolicies();
            await refreshIAMTabCounts();
        } else {
            const data = await res.json().catch(() => ({}));
            showToast(data.msg || 'Failed to delete policy');
        }
    } catch (err) {
        showToast('Error deleting policy');
    }
}

async function loadIAMAPIKeys() {
    try {
        const res = await fetch(`${API_URL}/iam/api-keys`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) return;

        const keys = await res.json();
        const keyCount = document.getElementById('tab-count-api-keys');
        if (keyCount) keyCount.innerText = String(keys.length);
        const container = document.getElementById('iam-api-keys-list');
        if (!container) return;

        container.innerHTML = '';

        if (keys.length === 0) {
            container.innerHTML = '<p style="color: #64748b; padding: 20px;">No API keys found. Generate one for programmatic access.</p>';
            return;
        }

        keys.forEach(key => {
            container.innerHTML += `
                <div class="card" style="margin-bottom: 15px; padding: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                            <strong style="font-size: 1.1rem;">${key.name}</strong>
                            <p style="font-family: monospace; background: #f1f5f9; padding: 5px 10px; border-radius: 4px; margin: 5px 0;">
                                ${key.key}
                            </p>
                            <small style="color: #64748b;">
                                Permissions: ${key.permissions?.join(', ') || 'None'}<br>
                                ${translate('profile.createdLabel')}: ${formatLocalizedDateShort(key.createdAt)}
                            </small>
                        </div>
                        <button class="btn btn-danger" style="font-size: 0.7rem;" onclick="revokeAPIKey('${key._id}')">Revoke</button>
                    </div>
                </div>
            `;
        });
    } catch (err) {
        console.error('Load API Keys Error:', err);
    }
}

async function openCreateAPIKeyModal() {
    const name = prompt('Enter API key name:');
    if (!name) return;

    const permissionsInput = prompt('Enter permissions (comma separated), e.g. instances:read,storage:read') || 'instances:read,storage:read';
    const permissions = permissionsInput.split(',').map(v => v.trim()).filter(Boolean);

    try {
        const res = await fetch(`${API_URL}/iam/api-keys`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, permissions })
        });

        const data = await res.json();
        if (res.ok) {
            showToast('API key created');
            if (data?.apiKey?.secret) {
                alert(`Save this API secret now (shown once):\n\n${data.apiKey.secret}`);
            }
            loadIAMAPIKeys();
            refreshIAMTabCounts();
        } else {
            showToast(data.msg || 'Failed to create API key');
        }
    } catch (err) {
        showToast('Error creating API key');
    }
}

async function revokeAPIKey(keyId) {
    if (!confirm('Revoke this API key?')) return;

    try {
        const res = await fetch(`${API_URL}/iam/api-keys/${keyId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            showToast('API key revoked');
            loadIAMAPIKeys();
            refreshIAMTabCounts();
        } else {
            const data = await res.json();
            showToast(data.msg || 'Failed to revoke API key');
        }
    } catch (err) {
        showToast('Error revoking API key');
    }
}

function setup2FAFromIAM() {
    showIAMTab('2fa');
    setup2FA();
}

async function loadAuditLogs() {
    try {
        const actionFilter = document.getElementById('audit-action-filter')?.value || '';
        const url = `${API_URL}/iam/audit-logs${actionFilter ? `?action=${actionFilter}` : ''}`;

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) return;

        const logs = await res.json();
        const tbody = document.getElementById('iam-audit-list');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #64748b;">No audit logs found</td></tr>';
            return;
        }

        logs.forEach(log => {
            const statusClass = log.status === 'success' ? 'bg-running' : 'bg-error';
            tbody.innerHTML += `
                <tr>
                    <td>${formatLocalizedDateTime(log.timestamp)}</td>
                    <td>${log.user?.email || 'System'}</td>
                    <td><span class="badge" style="background: #e2e8f0;">${log.action}</span></td>
                    <td>${log.resource || 'N/A'}</td>
                    <td><span class="badge ${statusClass}">${log.status}</span></td>
                    <td style="font-size: 0.8rem; max-width: 200px;">${JSON.stringify(log.details || {}).substring(0, 50)}...</td>
                </tr>
            `;
        });
    } catch (err) {
        console.error('Load Audit Logs Error:', err);
    }
}

// ============================================
// 2FA
// ============================================

async function load2FAStatus() {
    try {
        const res = await fetch(`${API_URL}/twoFA/status`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) return;

        const data = await res.json();
        const statusEl = document.getElementById('twoFA-status');
        const setupEl = document.getElementById('twoFA-setup');
        const setupBtn = document.getElementById('setup2FABtn');
        const disableBtn = document.getElementById('disable2FABtn');

        if (!statusEl) return;

        if (data.enabled) {
            statusEl.innerHTML = `<p style="color:var(--success);">${translate('profile.twoFAEnabledStatus')}</p>`;
            if (setupBtn) setupBtn.style.display = 'none';
            if (disableBtn) disableBtn.style.display = 'block';
            if (setupEl) setupEl.style.display = 'none';
        } else {
            statusEl.innerHTML = `<p style="color:#64748b;">${translate('profile.twoFADisabledStatus')}</p>`;
            if (setupBtn) setupBtn.style.display = 'block';
            if (disableBtn) disableBtn.style.display = 'none';
        }
    } catch (err) {
        console.error('2FA Error:', err);
    }
}

async function setup2FA() {
    try {
        const res = await fetch(`${API_URL}/twoFA/setup`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) return;

        const data = await res.json();
        const qrCodeEl = document.getElementById('qrCode');
        const setupEl = document.getElementById('twoFA-setup');
        const setupBtn = document.getElementById('setup2FABtn');

        if (qrCodeEl) qrCodeEl.src = data.qrCode;
        if (setupEl) setupEl.style.display = 'block';
        if (setupBtn) setupBtn.style.display = 'none';
    } catch (err) {
        showToast('Error setting up 2FA');
    }
}

async function verify2FA() {
    const token2FA = document.getElementById('twoFA-token')?.value;

    if (!token2FA) {
        showToast('Enter 2FA code');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/twoFA/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ token: token2FA })
        });

        if (res.ok) {
            showToast(translate('profile.twoFAEnabledMessage'));
            load2FAStatus();
        } else {
            showToast('Invalid token');
        }
    } catch (err) {
        showToast('Error verifying 2FA');
    }
}

async function disable2FA() {
    const token2FA = prompt('Enter 2FA code or backup code:');
    if (!token2FA) return;

    try {
        await fetch(`${API_URL}/twoFA/disable`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ token: token2FA })
        });

        showToast(translate('profile.twoFADisabledMessage'));
        load2FAStatus();
    } catch (err) {
        showToast('Error disabling 2FA');
    }
}

// ============================================
// REGIONS
// ============================================

function loadRegions() {
    const regions = [
        { code: 'us-east-1', name: 'US East (N. Virginia)', status: 'available' },
        { code: 'us-west-2', name: 'US West (Oregon)', status: 'available' },
        { code: 'eu-west-1', name: 'EU West (Ireland)', status: 'available' },
        { code: 'eu-central-1', name: 'EU Central (Frankfurt)', status: 'available' },
        { code: 'ap-south-1', name: 'Asia Pacific (Mumbai)', status: 'limited' },
        { code: 'ap-southeast-1', name: 'Asia Pacific (Singapore)', status: 'available' },
        { code: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)', status: 'available' },
        { code: 'ap-southeast-2', name: 'Asia Pacific (Sydney)', status: 'available' },
        { code: 'ca-central-1', name: 'Canada Central (Toronto)', status: 'available' },
        { code: 'sa-east-1', name: 'South America (Sao Paulo)', status: 'limited' }
    ];

    const container = document.getElementById('region-list');
    if (!container) return;

    container.innerHTML = '';

    regions.forEach(r => {
        const badgeClass = r.status === 'available' ? 'bg-running' : 'bg-provisioning';
        container.innerHTML += `
            <div class="card">
                <h4>${r.name}</h4>
                <p style="color:#64748b; margin:10px 0;">${r.code}</p>
                <span class="badge ${badgeClass}">${r.status}</span>
            </div>
        `;
    });
}

function showSaaSTab(tabName) {
    document.querySelectorAll('.saas-tab').forEach(tab => {
        tab.style.display = 'none';
    });

    const target = document.getElementById(`saas-${tabName}`);
    if (target) {
        target.style.display = 'block';
    }

    if (tabName === 'marketplace') {
        marketplaceServices = mergeMarketplaceServices(marketplaceServices);
        loadSaaSMarketplace();
        fetchMarketplaceCatalog().catch(() => { });
    } else if (tabName === 'subscriptions') {
        loadSaaSSubscriptions();
    } else if (tabName === 'integrations') {
        loadSaaSIntegrations();
    }
}

function startSaaSStatusAutoRefresh() {
    if (saasStatusRefreshInterval || !hasAuthenticatedSession()) {
        return;
    }

    saasStatusRefreshInterval = window.setInterval(() => {
        const saasPage = document.getElementById('saas');
        if (!saasPage?.classList.contains('active')) {
            return;
        }

        refreshDockerServices().catch(() => { });
    }, 15000);
}

function createDefaultApacheService(overrides = {}) {
    return {
        id: 'apache-server',
        type: 'apache',
        name: 'Apache Server',
        category: 'web',
        image: 'httpd',
        description: 'Web hosting server',
        icon: 'AP',
        containerId: '',
        containerName: 'bytesky-apache',
        url: 'http://localhost:8080',
        hostPort: 8080,
        containerPort: 80,
        status: 'Stopped',
        running: false,
        ...overrides
    };
}

function createDefaultJenkinsBuild(overrides = {}) {
    return {
        status: 'not_built',
        label: 'Not built yet',
        result: null,
        number: null,
        url: '',
        building: false,
        timestamp: null,
        durationMs: null,
        message: 'No Jenkins builds have run yet.',
        ...overrides
    };
}

function createDefaultJenkinsService(overrides = {}) {
    return {
        id: 'jenkins-cicd',
        type: 'jenkins',
        name: 'Jenkins CI/CD',
        category: 'developer-tools',
        image: 'jenkins/jenkins',
        description: 'Continuous integration and delivery pipeline server',
        icon: 'CI',
        containerId: '',
        containerName: 'bytesky-jenkins',
        port: 8081,
        hostPort: 8081,
        containerPort: 8080,
        url: 'http://localhost:8081',
        jobName: 'bytesky-node-app',
        status: 'stopped',
        running: false,
        ready: false,
        readyMessage: 'Jenkins is stopped.',
        build: createDefaultJenkinsBuild(),
        ...overrides
    };
}

function createDefaultPostgresService(overrides = {}) {
    return {
        id: 'postgresql',
        type: 'postgres',
        name: 'PostgreSQL',
        category: 'database',
        image: 'postgres',
        description: 'Relational database service',
        icon: 'DB',
        containerId: '',
        containerName: 'bytesky-postgres',
        port: 5432,
        hostPort: 5432,
        containerPort: 5432,
        status: 'stopped',
        running: false,
        connection: {
            host: 'localhost',
            port: 5432,
            user: 'admin',
            password: 'admin123',
            database: 'mydb'
        },
        ...overrides
    };
}

function createDefaultMetabaseService(overrides = {}) {
    return {
        id: 'metabase-analytics',
        type: 'metabase',
        name: 'Metabase Analytics',
        category: 'analytics',
        image: 'metabase/metabase',
        description: 'Data analytics and dashboard tool',
        icon: 'MB',
        containerId: '',
        containerName: 'metabase',
        port: 3005,
        hostPort: 3005,
        containerPort: 3000,
        url: 'http://localhost:3005',
        status: 'stopped',
        running: false,
        ...overrides
    };
}

function createDefaultRedisService(overrides = {}) {
    return {
        id: 'redis-cache',
        type: 'redis',
        name: 'Redis Cache',
        category: 'cache',
        image: 'redis',
        description: 'In-memory cache layer for fast API responses',
        icon: 'RD',
        containerId: '',
        containerName: 'bytesky-redis',
        port: 6379,
        hostPort: 6379,
        containerPort: 6379,
        status: 'stopped',
        running: false,
        connection: {
            host: 'localhost',
            port: 6379
        },
        ...overrides
    };
}

function createDefaultVmService(overrides = {}) {
    return {
        id: 'ubuntu-vm',
        type: 'vm',
        name: 'Ubuntu VM',
        category: 'compute',
        image: 'dorowu/ubuntu-desktop-lxde-vnc',
        description: 'Browser-based virtual machine (compute service)',
        icon: 'VM',
        containerId: '',
        containerName: 'vm',
        port: 6080,
        hostPort: 6080,
        containerPort: 80,
        url: 'http://localhost:6080',
        status: 'stopped',
        running: false,
        stateMessage: 'No active VM',
        ...overrides
    };
}

function getDefaultMarketplaceServices() {
    return [
        createDefaultApacheService(),
        createDefaultJenkinsService(),
        createDefaultPostgresService(),
        createDefaultRedisService(),
        createDefaultVmService(),
        createDefaultMetabaseService()
    ];
}

function mergeMarketplaceServices(services = []) {
    const merged = new Map(
        getDefaultMarketplaceServices().map((service) => [service.id, service])
    );

    services.forEach((service) => {
        if (!service?.id) {
            return;
        }

        const existing = merged.get(service.id) || {};
        merged.set(service.id, {
            ...existing,
            ...service
        });
    });

    return Array.from(merged.values());
}

function getMetabaseServiceFromDockerPayload(dockerData = {}) {
    if (dockerData.metabase) {
        return createDefaultMetabaseService(dockerData.metabase);
    }

    const containers = Array.isArray(dockerData.containers) ? dockerData.containers : [];
    const matchingContainer = containers.find((container) => {
        const normalizedName = String(container.name || '').toLowerCase();
        const normalizedImage = String(container.image || '').toLowerCase();

        return normalizedName === 'metabase'
            || normalizedImage.startsWith('metabase/metabase');
    });

    if (!matchingContainer) {
        return createDefaultMetabaseService();
    }

    const portBinding = Array.isArray(matchingContainer.ports)
        ? matchingContainer.ports.find((port) => port.publicPort === 3005 || port.privatePort === 3000)
        : null;

    return createDefaultMetabaseService({
        containerId: matchingContainer.id || '',
        containerName: matchingContainer.name || 'metabase',
        hostPort: portBinding?.publicPort || 3005,
        port: portBinding?.publicPort || 3005,
        containerPort: portBinding?.privatePort || 3000,
        status: matchingContainer.status || 'stopped',
        running: matchingContainer.status === 'running'
    });
}

function getRedisServiceFromDockerPayload(dockerData = {}) {
    if (dockerData.redis) {
        return createDefaultRedisService(dockerData.redis);
    }

    const containers = Array.isArray(dockerData.containers) ? dockerData.containers : [];
    const matchingContainer = containers.find((container) => {
        const normalizedName = String(container.name || '').toLowerCase();
        const normalizedImage = String(container.image || '').toLowerCase();

        return normalizedName === 'bytesky-redis'
            || normalizedImage.startsWith('redis');
    });

    if (!matchingContainer) {
        return createDefaultRedisService();
    }

    const portBinding = Array.isArray(matchingContainer.ports)
        ? matchingContainer.ports.find((port) => port.publicPort === 6379 || port.privatePort === 6379)
        : null;

    return createDefaultRedisService({
        containerId: matchingContainer.id || '',
        containerName: matchingContainer.name || 'bytesky-redis',
        hostPort: portBinding?.publicPort || 6379,
        port: portBinding?.publicPort || 6379,
        containerPort: portBinding?.privatePort || 6379,
        status: matchingContainer.status || 'stopped',
        running: matchingContainer.status === 'running'
    });
}

function getVmServiceFromDockerPayload(dockerData = {}) {
    if (dockerData.vm) {
        return createDefaultVmService(dockerData.vm);
    }

    const containers = Array.isArray(dockerData.containers) ? dockerData.containers : [];
    const matchingContainer = containers.find((container) => {
        const normalizedName = String(container.name || '').toLowerCase();
        const normalizedImage = String(container.image || '').toLowerCase();

        return normalizedName === 'vm'
            || normalizedImage.startsWith('dorowu/ubuntu-desktop-lxde-vnc');
    });

    if (!matchingContainer) {
        return createDefaultVmService();
    }

    const portBinding = Array.isArray(matchingContainer.ports)
        ? matchingContainer.ports.find((port) => port.publicPort === 6080 || port.privatePort === 80)
        : null;
    const running = matchingContainer.status === 'running';

    return createDefaultVmService({
        containerId: matchingContainer.id || '',
        containerName: matchingContainer.name || 'vm',
        hostPort: portBinding?.publicPort || 6080,
        port: portBinding?.publicPort || 6080,
        containerPort: portBinding?.privatePort || 80,
        status: matchingContainer.status || 'stopped',
        running,
        stateMessage: running ? 'Running' : 'No active VM'
    });
}

function loadSaaSMarketplace() {
    const grid = document.getElementById('saas-apps-grid');
    if (!grid) return;

    const search = (document.getElementById('saasSearch')?.value || '').trim().toLowerCase();
    const category = document.getElementById('saasCategory')?.value || 'all';

    const filteredApps = marketplaceServices.filter(app => {
        const matchesSearch = !search
            || app.name.toLowerCase().includes(search)
            || app.image.toLowerCase().includes(search)
            || app.description.toLowerCase().includes(search);
        const matchesCategory = category === 'all' || app.category === category;
        return matchesSearch && matchesCategory;
    });

    if (!filteredApps.length) {
        grid.innerHTML = '<div class="card" style="grid-column:1/-1; text-align:center; color:#64748b;">No Docker services are available for the current filters.</div>';
        return;
    }

    grid.innerHTML = filteredApps.map(app => {
        if (app.type === 'jenkins') {
            return `
        <div class="card saas-app-card">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
                <div style="font-size:2rem;">${app.icon || 'CI'}</div>
                <span class="badge ${app.running ? 'bg-running' : 'bg-stopped'}">${app.status.toUpperCase()}</span>
            </div>
            <h3 style="margin-top:10px;">${app.name}</h3>
            <div style="font-size:0.85rem; color:#2563eb; font-weight:600; margin-top:6px;">${app.image}</div>
            <p style="color:#64748b; margin:10px 0 12px;">${app.description}</p>
            <div style="font-size:0.85rem; color:#64748b; margin-bottom:6px;">Port: ${app.port}</div>
            <div style="font-size:0.82rem; color:#475569; line-height:1.6; margin-bottom:12px;">
                URL: ${app.url}<br>
                Job: ${app.jobName}<br>
                Ready: ${app.ready ? 'Yes' : 'No'}<br>
                Build: ${app.build?.label || 'Not built yet'}${app.build?.number ? ` (#${app.build.number})` : ''}
            </div>
            <div class="storage-actions saas-app-actions">
                <button class="storage-action-btn" type="button" onclick="launchJenkinsService()" ${app.running ? 'disabled' : ''}>Launch</button>
                <button class="storage-action-btn" type="button" onclick="openJenkinsService()" ${app.running ? '' : 'disabled'}>Open</button>
                <button class="storage-action-btn" type="button" onclick="triggerJenkinsBuild()" ${app.running && app.ready ? '' : 'disabled'}>Build</button>
                <button class="storage-action-btn" type="button" onclick="refreshJenkinsStatus(true)">Status</button>
                <button class="storage-action-btn storage-action-btn--danger" type="button" onclick="stopJenkinsService()" ${app.running ? '' : 'disabled'}>Stop</button>
            </div>
        </div>`;
        }

        if (app.type === 'postgres') {
            return `
        <div class="card saas-app-card">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
                <div style="font-size:2rem;">${app.icon || 'DB'}</div>
                <span class="badge ${app.running ? 'bg-running' : 'bg-stopped'}">${app.status.toUpperCase()}</span>
            </div>
            <h3 style="margin-top:10px;">${app.name}</h3>
            <div style="font-size:0.85rem; color:#2563eb; font-weight:600; margin-top:6px;">${app.image}</div>
            <p style="color:#64748b; margin:10px 0 12px;">${app.description}</p>
            <div style="font-size:0.85rem; color:#64748b; margin-bottom:6px;">Port: ${app.port}</div>
            <div style="font-size:0.82rem; color:#475569; line-height:1.6; margin-bottom:12px;">
                Host: ${app.connection.host}<br>
                Port: ${app.connection.port}<br>
                User: ${app.connection.user}<br>
                Password: ${app.connection.password}<br>
                Database: ${app.connection.database}
            </div>
            <div class="storage-actions saas-app-actions">
                <button class="storage-action-btn" type="button" onclick="runPostgresService()" ${app.running ? 'disabled' : ''}>Launch</button>
                <button class="storage-action-btn storage-action-btn--danger" type="button" onclick="stopPostgresService('${app.containerId}')" ${app.running && app.containerId ? '' : 'disabled'}>Stop</button>
                <button class="storage-action-btn" type="button" onclick="refreshDockerServices()">Refresh</button>
            </div>
        </div>`;
        }

        if (app.type === 'redis') {
            return `
        <div class="card saas-app-card">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
                <div style="font-size:2rem;">${app.icon || 'RD'}</div>
                <span class="badge ${app.running ? 'bg-running' : 'bg-stopped'}">${app.status.toUpperCase()}</span>
            </div>
            <h3 style="margin-top:10px;">${app.name}</h3>
            <div style="font-size:0.85rem; color:#2563eb; font-weight:600; margin-top:6px;">${app.image}</div>
            <p style="color:#64748b; margin:10px 0 12px;">${app.description}</p>
            <div style="font-size:0.85rem; color:#64748b; margin-bottom:6px;">Port: ${app.port}</div>
            <div style="font-size:0.82rem; color:#475569; line-height:1.6; margin-bottom:12px;">
                Host: ${app.connection.host}<br>
                Port: ${app.connection.port}<br>
                Container: ${app.containerName || 'bytesky-redis'}
            </div>
            <div class="storage-actions saas-app-actions">
                <button class="storage-action-btn" type="button" onclick="runRedisService()" ${app.running ? 'disabled' : ''}>Launch</button>
                <button class="storage-action-btn storage-action-btn--danger" type="button" onclick="stopRedisService('${app.containerId}')" ${app.running && app.containerId ? '' : 'disabled'}>Stop</button>
                <button class="storage-action-btn" type="button" onclick="refreshRedisStatus(true)">Refresh</button>
            </div>
        </div>`;
        }

        if (app.type === 'vm') {
            return `
        <div class="card saas-app-card">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
                <div style="font-size:2rem;">${app.icon || 'VM'}</div>
                <span class="badge ${app.running ? 'bg-running' : 'bg-stopped'}">${app.status.toUpperCase()}</span>
            </div>
            <h3 style="margin-top:10px;">${app.name}</h3>
            <div style="font-size:0.85rem; color:#2563eb; font-weight:600; margin-top:6px;">${app.image}</div>
            <p style="color:#64748b; margin:10px 0 12px;">${app.description}</p>
            <div style="font-size:0.85rem; color:#64748b; margin-bottom:6px;">URL: ${app.url}</div>
            <div style="font-size:0.82rem; color:#475569; line-height:1.6; margin-bottom:12px;">
                Status: ${app.stateMessage || 'No active VM'}<br>
                Container: ${app.containerName || 'vm'}<br>
                Port: ${app.hostPort}:${app.containerPort}
            </div>
            <div class="storage-actions saas-app-actions">
                <button class="storage-action-btn" type="button" onclick="runVmService()" ${app.running ? 'disabled' : ''}>Launch</button>
                <button class="storage-action-btn" type="button" onclick="openVmService()" ${app.running ? '' : 'disabled'}>Open</button>
                <button class="storage-action-btn storage-action-btn--danger" type="button" onclick="stopVmService('${app.containerId}')" ${app.running && app.containerId ? '' : 'disabled'}>Stop</button>
                <button class="storage-action-btn" type="button" onclick="refreshVmStatus(true)">Refresh</button>
            </div>
        </div>`;
        }

        if (app.type === 'metabase') {
            return `
        <div class="card saas-app-card">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
                <div style="font-size:2rem;">${app.icon || 'MB'}</div>
                <span class="badge ${app.running ? 'bg-running' : 'bg-stopped'}">${app.status.toUpperCase()}</span>
            </div>
            <h3 style="margin-top:10px;">${app.name}</h3>
            <div style="font-size:0.85rem; color:#2563eb; font-weight:600; margin-top:6px;">${app.image}</div>
            <p style="color:#64748b; margin:10px 0 12px;">${app.description}</p>
            <div style="font-size:0.85rem; color:#64748b; margin-bottom:6px;">Port: ${app.port}</div>
            <div style="font-size:0.82rem; color:#475569; line-height:1.6; margin-bottom:12px;">
                URL: ${app.url}<br>
                Container: ${app.containerName || 'metabase'}<br>
                Status: ${app.status}
            </div>
            <div class="storage-actions saas-app-actions">
                <button class="storage-action-btn" type="button" onclick="runMetabaseService()" ${app.running ? 'disabled' : ''}>Launch</button>
                <button class="storage-action-btn" type="button" onclick="openMetabaseService()" ${app.running ? '' : 'disabled'}>Open</button>
                <button class="storage-action-btn" type="button" onclick="refreshMetabaseStatus(true)">Status</button>
                <button class="storage-action-btn storage-action-btn--danger" type="button" onclick="stopMetabaseService('${app.containerId}')" ${app.running && app.containerId ? '' : 'disabled'}>Stop</button>
            </div>
        </div>`;
        }

        return `
        <div class="card saas-app-card">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
                <div style="font-size:2rem;">${app.icon || '🐳'}</div>
                <span class="badge ${app.running ? 'bg-running' : 'bg-stopped'}">${app.status.toUpperCase()}</span>
            </div>
            <h3 style="margin-top:10px;">${app.name}</h3>
            <div style="font-size:0.85rem; color:#2563eb; font-weight:600; margin-top:6px;">${app.image}</div>
            <p style="color:#64748b; margin:10px 0 16px;">${app.description}</p>
            <div style="font-size:0.85rem; color:#64748b; margin-bottom:12px;">Port mapping: ${app.hostPort}:${app.containerPort}</div>
            <div class="storage-actions saas-app-actions">
                <button class="storage-action-btn" type="button" onclick="launchMarketplaceService('${app.id}')" ${app.running ? 'disabled' : ''}>Launch</button>
                <button class="storage-action-btn" type="button" onclick="openApacheService('${app.id}')" ${app.running ? '' : 'disabled'}>Open</button>
                <button class="storage-action-btn storage-action-btn--danger" type="button" onclick="stopMarketplaceService('${app.id}')" ${app.running ? '' : 'disabled'}>Stop</button>
            </div>
        </div>
    `;
    }).join('');
}

// ============================================
// INITIALIZATION
// ============================================

window.addEventListener('DOMContentLoaded', async () => {
    console.log(' ByteSky Frontend Loaded');
    if (await alignLocalOriginWithConfig()) {
        return;
    }
    applyTheme();
    applyLanguagePreference();
    syncMonitoringMetricButtons();
    window.launchVM = launchVM;
    window.launchBrowserVm = launchVM;
    const launchBtn = document.getElementById('launchVmBtn');
    if (launchBtn) {
        console.log('[VM] Launch button found and binding click listener');
        launchBtn.addEventListener('click', (event) => {
            console.log('[VM] launchVmBtn click event fired');
            event.preventDefault();
            launchVM();
        });
    } else {
        console.warn('[VM] Launch button not found during initialization');
    }
    await checkSession();
    confirmStripeCheckoutIfNeeded();
});

window.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', handleSidebarDismiss);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && isCompactSidebarLayout()) {
            setSidebarOpen(false);
        }
    });

    const mainContent = getMainContentElement();
    if (mainContent) {
        mainContent.addEventListener('scroll', updateNavScrollState, { passive: true });
    }

    const activePage = document.querySelector('.page.active');
    if (!activePage) {
        console.log(' No active page, showing home...');
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const home = document.getElementById('home');
        if (home) home.classList.add('active');
    }

    initializeMarketingReveal();
    updateNavScrollState();
});

window.addEventListener('resize', syncSidebarLayout);

if (SYSTEM_THEME_QUERY) {
    const handleSystemThemeChange = () => {
        if (getSavedThemePreference() === 'system') {
            applyTheme('system');
        }
    };

    if (typeof SYSTEM_THEME_QUERY.addEventListener === 'function') {
        SYSTEM_THEME_QUERY.addEventListener('change', handleSystemThemeChange);
    } else if (typeof SYSTEM_THEME_QUERY.addListener === 'function') {
        SYSTEM_THEME_QUERY.addListener(handleSystemThemeChange);
    }
}


function filterSaaSApps() {
    loadSaaSMarketplace();
}

function openSaaSDetails(appId) {
    const app = marketplaceServices.find(a => a.id === appId);
    if (!app) return;

    selectedSaaSApp = app;

    document.getElementById('saasModalTitle').innerText = `${app.icon} ${app.name}`;
    document.getElementById('saasModalDesc').innerText = app.description;

    const pricingContainer = document.getElementById('saasModalPricing');
    pricingContainer.innerHTML = `
        <div class="saas-pricing-card">
            <div style="font-weight: 600; margin-bottom: 10px;">Docker Image</div>
            <div class="saas-price" style="font-size:1.25rem;">${app.image}</div>
            <div class="saas-price-period">Available on this Docker host</div>
        </div>
        <div class="saas-pricing-card">
            <div style="font-weight: 600; margin-bottom: 10px;">Service Type</div>
            <div class="saas-price" style="font-size:1.25rem; text-transform:capitalize;">${app.category.replace('-', ' ')}</div>
            <div class="saas-price-period">Real container-based cloud service</div>
        </div>
        <div class="saas-pricing-card popular">
            <div style="background: var(--primary); color: white; padding: 4px; border-radius: 4px; font-size: 0.75rem; margin-bottom: 10px;">Launch Ready</div>
            <div style="font-weight: 600; margin-bottom: 10px;">Provisioning</div>
            <div class="saas-price" style="font-size:1.25rem;">Instant</div>
            <div class="saas-price-period">Creates a Docker container on demand</div>
        </div>
    `;

    const featuresContainer = document.getElementById('saasModalFeatures');
    featuresContainer.innerHTML = [
        `Service name: ${app.name}`,
        `Docker image: ${app.image}`,
        `Category: ${app.category}`,
        'Managed by the ByteSky Docker control plane',
        'Appears in My Subscriptions after launch'
    ].map(f => `<li style="padding: 5px 0;">${f}</li>`).join('');

    openModal('saasDetailsModal');
}

async function fetchMarketplaceServices() {
    const services = [];
    const errors = [];

    const authHeaders = { 'Authorization': `Bearer ${token}` };
    const [apacheResult, jenkinsResult, dockerResult] = await Promise.allSettled([
        fetch(`${API_URL}/container/apache/status`, { headers: authHeaders }),
        fetch(`${API_URL}/jenkins/status`, { headers: authHeaders }),
        fetch(`${API_URL}/docker/containers`, { headers: authHeaders })
    ]);

    try {
        if (apacheResult.status === 'rejected') {
            throw apacheResult.reason;
        }

        const apacheData = await apacheResult.value.json().catch(() => ({}));
        if (!apacheResult.value.ok) {
            throw new Error(apacheData.message || apacheData.msg || 'Unable to load Apache service');
        }

        if (apacheData.service) {
            services.push({ ...apacheData.service, type: 'apache' });
        }
    } catch (err) {
        errors.push(err.message || 'Unable to load Apache service');
    }

    try {
        if (jenkinsResult.status === 'rejected') {
            throw jenkinsResult.reason;
        }

        const jenkinsData = await jenkinsResult.value.json().catch(() => ({}));
        if (!jenkinsResult.value.ok) {
            throw new Error(jenkinsData.message || jenkinsData.msg || 'Unable to load Jenkins service');
        }

        if (jenkinsData.service) {
            services.push(jenkinsData.service);
        }
    } catch (err) {
        errors.push(err.message || 'Unable to load Jenkins service');
    }

    try {
        if (dockerResult.status === 'rejected') {
            throw dockerResult.reason;
        }

        const dockerData = await dockerResult.value.json().catch(() => ({}));
        if (!dockerResult.value.ok) {
            throw new Error(dockerData.message || dockerData.msg || 'Unable to load PostgreSQL service');
        }

        if (dockerData.postgres) {
            services.push(dockerData.postgres);
        }

        services.push(getRedisServiceFromDockerPayload(dockerData));
        services.push(getVmServiceFromDockerPayload(dockerData));
        services.push(getMetabaseServiceFromDockerPayload(dockerData));
    } catch (err) {
        errors.push(err.message || 'Unable to load Docker services');
        services.push(createDefaultRedisService());
        services.push(createDefaultVmService());
        services.push(createDefaultMetabaseService());
    }

    return { services, errors };
}

async function fetchMarketplaceCatalog() {
    const { services, errors } = await fetchMarketplaceServices();
    marketplaceServices = mergeMarketplaceServices(services);

    if (!marketplaceServices.length && errors.length) {
        const grid = document.getElementById('saas-apps-grid');
        if (grid) {
            grid.innerHTML = `<div class="card" style="grid-column:1/-1; text-align:center; color:#64748b;">${errors.join(' | ')}</div>`;
        }
        return;
    }

    loadSaaSMarketplace();
}

async function refreshDockerServices() {
    await fetchMarketplaceCatalog();
    await loadSaaSSubscriptions();
}

async function subscribeToSaaS() {
    if (!selectedSaaSApp) {
        showToast('Select a service first');
        return;
    }

    if (selectedSaaSApp.type === 'postgres') {
        await runPostgresService(true);
        return;
    }

    if (selectedSaaSApp.type === 'jenkins') {
        await launchJenkinsService(true);
        return;
    }

    if (selectedSaaSApp.type === 'redis') {
        await runRedisService(true);
        return;
    }

    if (selectedSaaSApp.type === 'vm') {
        await runVmService(true);
        return;
    }

    if (selectedSaaSApp.type === 'metabase') {
        await runMetabaseService(true);
        return;
    }

    await launchMarketplaceService(selectedSaaSApp.id, true);
}

async function launchMarketplaceService(serviceId, closeDetails = false) {
    const service = marketplaceServices.find(item => item.id === serviceId);
    if (!service) {
        showToast('Service not found');
        return;
    }

    if (service.type === 'postgres') {
        await runPostgresService(closeDetails);
        return;
    }

    if (service.type === 'jenkins') {
        await launchJenkinsService(closeDetails);
        return;
    }

    if (service.type === 'redis') {
        await runRedisService(closeDetails);
        return;
    }

    if (service.type === 'vm') {
        await runVmService(closeDetails);
        return;
    }

    if (service.type === 'metabase') {
        await runMetabaseService(closeDetails);
        return;
    }

    try {
        const res = await fetch(`${API_URL}/container/apache/launch`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.message || data.msg || 'Unable to launch Apache Server');
        }

        if (closeDetails) {
            closeModal('saasDetailsModal');
        }

        showToast(`${service.name} launched successfully`);
        await fetchMarketplaceCatalog();
        await loadSaaSSubscriptions();
    } catch (err) {
        showToast(err.message || 'Launch failed');
    }
}

function openApacheService(serviceId) {
    const service = marketplaceServices.find(item => item.id === serviceId);
    if (!service?.running) {
        showToast('Apache Server is not running');
        return;
    }

    window.open(service.url, '_blank', 'noopener');
}

function getJenkinsService() {
    return marketplaceServices.find(item => item.type === 'jenkins' || item.id === 'jenkins-cicd');
}

function getMetabaseService() {
    return marketplaceServices.find(item => item.type === 'metabase' || item.id === 'metabase-analytics');
}

function getRedisService() {
    return marketplaceServices.find(item => item.type === 'redis' || item.id === 'redis-cache');
}

function getVmService() {
    return marketplaceServices.find(item => item.type === 'vm' || item.id === 'ubuntu-vm');
}

async function launchJenkinsService(closeDetails = false) {
    try {
        const res = await fetch(`${API_URL}/jenkins/launch`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.message || data.msg || 'Unable to launch Jenkins');
        }

        if (closeDetails) {
            closeModal('saasDetailsModal');
        }

        showToast('Jenkins launched successfully');
        await refreshDockerServices();
    } catch (err) {
        showToast(err.message || 'Unable to launch Jenkins');
    }
}

function openJenkinsService() {
    const service = getJenkinsService();
    if (!service?.running) {
        showToast('Jenkins is not running');
        return;
    }

    window.open(service.url, '_blank', 'noopener');
}

async function triggerJenkinsBuild() {
    const service = getJenkinsService();
    if (!service?.running) {
        showToast('Launch Jenkins before triggering a build');
        return;
    }

    if (!service.ready) {
        showToast(service.readyMessage || 'Jenkins is still starting up');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/jenkins/build`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.message || data.msg || 'Unable to trigger Jenkins build');
        }

        showToast(data.message || 'Jenkins build triggered');
        await refreshDockerServices();
    } catch (err) {
        showToast(err.message || 'Unable to trigger Jenkins build');
    }
}

async function refreshJenkinsStatus(showResult = false) {
    try {
        const res = await fetch(`${API_URL}/jenkins/status`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.message || data.msg || 'Unable to load Jenkins status');
        }

        if (showResult) {
            const service = data.service;
            if (!service?.running) {
                showToast('Jenkins is stopped');
            } else if (!service.ready) {
                showToast(service.readyMessage || 'Jenkins is still starting up');
            } else if (service.build?.number) {
                showToast(`Jenkins build ${service.build.label} (#${service.build.number})`);
            } else {
                showToast(service.build?.label || 'Jenkins is ready');
            }
        }

        await refreshDockerServices();
    } catch (err) {
        showToast(err.message || 'Unable to load Jenkins status');
    }
}

async function stopJenkinsService(skipConfirm = false) {
    if (!skipConfirm && !confirm('Stop Jenkins CI/CD?')) return;

    try {
        const res = await fetch(`${API_URL}/jenkins/stop`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.message || data.msg || 'Unable to stop Jenkins');
        }

        showToast('Jenkins stopped');
        await refreshDockerServices();
    } catch (err) {
        showToast(err.message || 'Unable to stop Jenkins');
    }
}

async function runRedisService(closeDetails = false) {
    try {
        const res = await fetch(`${API_URL}/docker/run-redis`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.message || data.msg || 'Unable to launch Redis');
        }

        if (closeDetails) {
            closeModal('saasDetailsModal');
        }

        showToast(`Redis ${data.status}`);
        await refreshDockerServices();
    } catch (err) {
        showToast(err.message || 'Unable to launch Redis');
    }
}

async function refreshRedisStatus(showResult = false) {
    try {
        await refreshDockerServices();

        if (showResult) {
            const service = getRedisService();
            showToast(`Redis is ${service?.status || 'unknown'}`);
        }
    } catch (err) {
        showToast(err.message || 'Unable to load Redis status');
    }
}

async function stopRedisService(containerId, skipConfirm = false) {
    if (!containerId) {
        showToast('Redis container is not available');
        return;
    }

    if (!skipConfirm && !confirm('Stop Redis Cache?')) return;

    try {
        const res = await fetch(`${API_URL}/docker/stop/${containerId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.message || data.msg || 'Unable to stop Redis');
        }

        showToast(`Redis ${data.status}`);
        await refreshDockerServices();
    } catch (err) {
        showToast(err.message || 'Unable to stop Redis');
    }
}

async function runVmService(closeDetails = false) {
    try {
        const res = await fetch(`${API_URL}/docker/run-vm`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.message || data.msg || 'Unable to launch Ubuntu VM');
        }

        if (closeDetails) {
            closeModal('saasDetailsModal');
        }

        showToast(`Ubuntu VM ${data.status}`);
        await refreshDockerServices();
    } catch (err) {
        showToast(err.message || 'Unable to launch Ubuntu VM');
    }
}

function openVmService() {
    const service = getVmService();
    if (!service?.running) {
        showToast('No active VM');
        return;
    }

    window.open(service.url || 'http://localhost:6080', '_blank', 'noopener');
}

async function refreshVmStatus(showResult = false) {
    try {
        await refreshDockerServices();

        if (showResult) {
            const service = getVmService();
            showToast(service?.running ? `Ubuntu VM is ${service.status}` : 'No active VM');
        }
    } catch (err) {
        showToast(err.message || 'Unable to load Ubuntu VM status');
    }
}

async function stopVmService(containerId, skipConfirm = false) {
    if (!containerId) {
        showToast('Ubuntu VM container is not available');
        return;
    }

    if (!skipConfirm && !confirm('Stop Ubuntu VM?')) return;

    try {
        const res = await fetch(`${API_URL}/docker/stop/${containerId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.message || data.msg || 'Unable to stop Ubuntu VM');
        }

        showToast(`Ubuntu VM ${data.status}`);
        await refreshDockerServices();
    } catch (err) {
        showToast(err.message || 'Unable to stop Ubuntu VM');
    }
}

async function runMetabaseService(closeDetails = false) {
    try {
        const res = await fetch(`${API_URL}/docker/run-metabase`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            if (res.status === 404) {
                throw new Error('Metabase API not available yet. Restart the backend server and try again.');
            }
            throw new Error(data.message || data.msg || 'Unable to launch Metabase');
        }

        if (closeDetails) {
            closeModal('saasDetailsModal');
        }

        showToast(`Metabase ${data.status}`);
        await refreshDockerServices();
    } catch (err) {
        showToast(err.message || 'Unable to launch Metabase');
    }
}

function openMetabaseService() {
    const service = getMetabaseService();
    if (!service?.running) {
        showToast('Metabase is not running');
        return;
    }

    window.open(service.url || 'http://localhost:3005', '_blank', 'noopener');
}

async function refreshMetabaseStatus(showResult = false) {
    try {
        await refreshDockerServices();

        if (showResult) {
            const service = getMetabaseService();
            showToast(`Metabase is ${service?.status || 'unknown'}`);
        }
    } catch (err) {
        showToast(err.message || 'Unable to load Metabase status');
    }
}

async function stopMetabaseService(containerId, skipConfirm = false) {
    if (!containerId) {
        showToast('Metabase container is not available');
        return;
    }

    if (!skipConfirm && !confirm('Stop Metabase Analytics?')) return;

    try {
        const res = await fetch(`${API_URL}/docker/stop/${containerId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.message || data.msg || 'Unable to stop Metabase');
        }

        showToast(`Metabase ${data.status}`);
        await refreshDockerServices();
    } catch (err) {
        showToast(err.message || 'Unable to stop Metabase');
    }
}

async function runPostgresService(closeDetails = false) {
    try {
        const res = await fetch(`${API_URL}/docker/run-postgres`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.message || data.msg || 'Unable to launch PostgreSQL');
        }

        if (closeDetails) {
            closeModal('saasDetailsModal');
        }

        showToast(`PostgreSQL ${data.status}`);
        await refreshDockerServices();
    } catch (err) {
        showToast(err.message || 'Unable to launch PostgreSQL');
    }
}

async function stopPostgresService(containerId, skipConfirm = false) {
    if (!containerId) {
        showToast('PostgreSQL container is not available');
        return;
    }

    if (!skipConfirm && !confirm('Stop PostgreSQL?')) return;

    try {
        const res = await fetch(`${API_URL}/docker/stop/${containerId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.message || data.msg || 'Unable to stop PostgreSQL');
        }

        showToast(`PostgreSQL ${data.status}`);
        await refreshDockerServices();
    } catch (err) {
        showToast(err.message || 'Unable to stop PostgreSQL');
    }
}

async function stopMarketplaceService(serviceId) {
    const service = marketplaceServices.find(item => item.id === serviceId);
    if (!service) {
        showToast('Service not found');
        return;
    }

    if (service.type === 'postgres') {
        await stopPostgresService(service.containerId);
        return;
    }

    if (service.type === 'jenkins') {
        await stopJenkinsService();
        return;
    }

    if (service.type === 'redis') {
        await stopRedisService(service.containerId);
        return;
    }

    if (service.type === 'vm') {
        await stopVmService(service.containerId);
        return;
    }

    if (service.type === 'metabase') {
        await stopMetabaseService(service.containerId);
        return;
    }

    if (!confirm('Stop Apache Server?')) return;

    try {
        const res = await fetch(`${API_URL}/container/apache/stop`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.message || data.msg || 'Unable to stop Apache Server');
        }

        showToast('Apache Server stopped');
        await fetchMarketplaceCatalog();
        await loadSaaSSubscriptions();
    } catch (err) {
        showToast(err.message || 'Unable to stop Apache Server');
    }
}

async function loadSaaSSubscriptions() {
    const container = document.getElementById('saas-subscriptions-list');
    if (!container) return;

    const { services, errors } = await fetchMarketplaceServices();
    activeMarketplaceSessions = services.filter(service => service.running);

    const mySubscriptions = activeMarketplaceSessions;

    if (mySubscriptions.length === 0) {
        if (errors.length) {
            container.innerHTML = `<p style="text-align: center; color: #64748b; padding: 40px;">${errors.join(' | ')}</p>`;
            return;
        }
        container.innerHTML = '<p style="text-align: center; color: #64748b; padding: 40px;">No running services yet. Launch one from the marketplace to get started.</p>';
        return;
    }

    container.innerHTML = mySubscriptions.map(sub => `
        <div class="saas-subscription-item">
            <div class="saas-subscription-info">
                <h4>${sub.name}</h4>
                <div class="saas-subscription-meta">
                    Image: <strong>${sub.image}</strong> |
                    Container: ${sub.containerName || 'Not assigned'} |
                    ${sub.type === 'postgres'
            ? `Host: ${sub.connection.host} | Port: ${sub.connection.port} | DB: ${sub.connection.database}`
            : sub.type === 'jenkins'
                ? `URL: ${sub.url} | Job: ${sub.jobName} | Build: ${sub.build?.label || 'Not built yet'}`
                : sub.type === 'redis'
                    ? `Host: ${sub.connection.host} | Port: ${sub.connection.port}`
                    : sub.type === 'vm'
                        ? `URL: ${sub.url} | Container: ${sub.containerName || 'vm'}`
                        : sub.type === 'metabase'
                            ? `URL: ${sub.url} | Container: ${sub.containerName || 'metabase'}`
                            : `URL: ${sub.url}`}
                </div>
            </div>
            <div style="display: flex; gap: 10px; align-items: center;">
                <div style="text-align: right;">
                    <div style="font-weight: 600; color: var(--primary);">${sub.type === 'postgres' || sub.type === 'redis' ? `localhost:${sub.connection.port}` : `<a href="${sub.url}" target="_blank" rel="noopener">Open</a>`}</div>
                    <div style="font-size: 0.85rem; color: #10b981;">${sub.type === 'jenkins' ? `${sub.status} | ${sub.build?.label || 'Not built yet'}` : sub.status}</div>
                </div>
                <button class="btn btn-outline" style="font-size: 0.75rem;" onclick="manageSubscription('${sub.id}')">${sub.type === 'postgres' || sub.type === 'redis' ? 'Refresh' : 'Open'}</button>
                <button class="btn btn-danger" style="font-size: 0.75rem;" onclick="cancelSubscription('${sub.id}')">Stop</button>
            </div>
        </div>
    `).join('');
}

function manageSubscription(subId) {
    const sub = activeMarketplaceSessions.find(s => s.id === subId);
    if (!sub) return;

    if (sub.type === 'postgres') {
        refreshDockerServices();
        return;
    }

    if (sub.type === 'redis') {
        refreshDockerServices();
        return;
    }

    if (sub.type === 'vm') {
        openVmService();
        return;
    }

    if (sub.type === 'jenkins') {
        if (sub.url) {
            window.open(sub.url, '_blank', 'noopener');
            return;
        }

        showToast('Jenkins URL is not available yet');
        return;
    }

    if (sub.type === 'metabase') {
        openMetabaseService();
        return;
    }

    if (sub.url) {
        window.open(sub.url, '_blank', 'noopener');
        return;
    }

    showToast(`${sub.image} is running as a background service with no public URL`);
}

async function cancelSubscription(subId) {
    const sub = activeMarketplaceSessions.find(s => s.id === subId);
    if (!sub) return;

    if (sub.type === 'postgres') {
        await stopPostgresService(sub.containerId);
        return;
    }

    if (sub.type === 'jenkins') {
        await stopJenkinsService();
        return;
    }

    if (sub.type === 'redis') {
        await stopRedisService(sub.containerId);
        return;
    }

    if (sub.type === 'vm') {
        await stopVmService(sub.containerId);
        return;
    }

    if (sub.type === 'metabase') {
        await stopMetabaseService(sub.containerId);
        return;
    }

    if (!confirm('Stop Apache Server? The Docker container will be terminated.')) return;

    try {
        const res = await fetch(`${API_URL}/container/apache/stop`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.message || data.msg || 'Unable to stop Apache Server');
        }

        showToast('Apache Server stopped');
        await fetchMarketplaceCatalog();
        await loadSaaSSubscriptions();
    } catch (err) {
        showToast(err.message || 'Unable to stop Apache Server');
    }
}

function loadSaaSIntegrations() {
    const container = document.getElementById('saas-integrations-list');
    const myIntegrations = saasIntegrations.filter(i => i.owner === currentUser?.email);

    if (myIntegrations.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #64748b; padding: 40px;">No integrations configured.</p>';
        return;
    }

    container.innerHTML = myIntegrations.map(int => `
        <div class="saas-integration-item">
            <div>
                <strong>${int.name}</strong>
                <div style="font-size: 0.85rem; color: #64748b;">${translate('profile.connectedAt')}: ${formatLocalizedDateShort(int.connectedAt)}</div>
            </div>
            <div style="display: flex; gap: 10px; align-items: center;">
                <span class="integration-status ${int.status === 'connected' ? 'connected' : 'disconnected'}">
                    ${int.status === 'connected' ? 'Connected' : 'Disconnected'}
                </span>
                <button class="btn btn-outline" style="font-size: 0.75rem;" onclick="configureIntegration('${int.id}')">Configure</button>
                <button class="btn btn-danger" style="font-size: 0.75rem;" onclick="disconnectIntegration('${int.id}')">Disconnect</button>
            </div>
        </div>
    `).join('');
}

function configureIntegration(intId) {
    const int = saasIntegrations.find(i => i.id === intId);
    if (!int) return;

    const nextName = prompt('Integration display name:', int.name || '');
    if (!nextName) return;

    const nextStatusInput = prompt('Status (connected/disconnected):', int.status || 'connected');
    if (!nextStatusInput) return;

    int.name = nextName.trim();
    int.status = nextStatusInput.toLowerCase() === 'disconnected' ? 'disconnected' : 'connected';
    int.connectedAt = int.connectedAt || new Date().toISOString();

    localStorage.setItem('bytesky_saas_integrations', JSON.stringify(saasIntegrations));
    showToast(`${int.name} integration updated`);
    loadSaaSIntegrations();
}

function disconnectIntegration(intId) {
    if (!confirm('Disconnect this integration?')) return;

    saasIntegrations = saasIntegrations.filter(i => i.id !== intId);
    localStorage.setItem('bytesky_saas_integrations', JSON.stringify(saasIntegrations));

    showToast('Integration disconnected');
    loadSaaSIntegrations();
}


// Initialize SaaS data if not exists
if (!localStorage.getItem('bytesky_saas_integrations')) {
    localStorage.setItem('bytesky_saas_integrations', JSON.stringify([]));
}
