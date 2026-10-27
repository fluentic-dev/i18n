import type { TranslationItem } from '@fluentic/i18n';

/** Shared by the interactive casebook and its executable tests. */
export const catalogs: Record<string, TranslationItem[]> = {
  en: [],
  fr: [
    ['Fluentic casebook', 'Cahier de cas Fluentic'],
    ['A practical i18n test bench', 'Un banc d’essai i18n pratique'],
    [
      'Use the overview as a realistic product screen, then open the case lab to exercise one behavior at a time.',
      'Utilisez la vue d’ensemble comme un écran produit réaliste, puis ouvrez le laboratoire pour tester chaque comportement.',
    ],
    ['Overview', 'Vue d’ensemble'],
    ['Case lab', 'Laboratoire'],
    ['Language', 'Langue'],
    ['Invite teammate', 'Inviter un équipier'],
    ['Workspace summary', 'Résumé de l’espace'],
    ['Updated {date, date, short}', 'Mis à jour le {date, date, short}'],
    [
      '{count, plural, =0 {No members} one {# member} other {# members}}',
      '{count, plural, =0 {Aucun membre} one {# membre} other {# membres}}',
    ],
    ['Monthly active users', 'Utilisateurs actifs mensuels'],
    ['Localization rollout', 'Déploiement de la localisation'],
    [
      '{status, select, on_track {On track} at_risk {At risk} done {Complete} other {Unknown}}',
      '{status, select, on_track {Dans les temps} at_risk {À risque} done {Terminé} other {Inconnu}}',
    ],
    [
      '{completed, number} of {total, number} tasks complete',
      '{completed, number} tâches sur {total, number} terminées',
    ],
    [
      'Next milestone: <strong>review translated strings</strong> with the regional teams.',
      'Prochaine étape : <strong>relire les chaînes traduites</strong> avec les équipes régionales.',
    ],
    ['Recent activity', 'Activité récente'],
    ['{name} changed the {field} in {project}.', '{name} a modifié {field} dans {project}.'],
    [
      '{count, plural, one {# more event} other {# more events}}',
      '{count, plural, one {# événement supplémentaire} other {# événements supplémentaires}}',
    ],
    ['Test controls', 'Contrôles de test'],
    ['Change values to exercise formatting', 'Modifiez les valeurs pour tester le formatage'],
    ['Team members', 'Membres de l’équipe'],
    ['Save preferences', 'Enregistrer les préférences'],
    [
      'Each card is a reproducible behavior covered by the example test suite.',
      'Chaque carte est un comportement reproductible couvert par les tests de l’exemple.',
    ],
    ['Plural branches', 'Branches de pluriel'],
    ['Try zero, one, and many.', 'Essayez zéro, un et plusieurs.'],
    ['Select branches', 'Branches de sélection'],
    ['Every product state has copy.', 'Chaque état du produit a son libellé.'],
    ['Numbers and dates', 'Nombres et dates'],
    ['Locale-aware output from real values.', 'Un rendu adapté à la langue à partir de valeurs réelles.'],
    ['Invoice total: {amount, number, ::currency/EUR}', 'Total de la facture : {amount, number, ::currency/EUR}'],
    ['Due {date, date, long}', 'Échéance le {date, date, long}'],
    ['Rich text', 'Texte enrichi'],
    ['Translators can move tagged content.', 'Les traducteurs peuvent déplacer le contenu balisé.'],
    [
      'Read the <link>integration guide</link> before shipping.',
      'Avant de publier, consultez le <link>guide d’intégration</link>.',
    ],
    ['Context', 'Contexte'],
    ['The same source can mean different things.', 'Une même source peut avoir plusieurs sens.'],
    ['navigation\0Open', 'Ouvrir'],
    ['ticket.status\0Open', 'En cours'],
    ['Menu action', 'Action du menu'],
    ['Ticket state', 'État du ticket'],
    ['Regional fallback', 'Repli régional'],
    [
      'fr-CA loads the fr catalog before falling back to source copy.',
      'fr-CA charge le catalogue fr avant de revenir au texte source.',
    ],
    ['This sentence exists in French.', 'Cette phrase existe en français.'],
    ['Source fallback', 'Repli vers la source'],
    ['Missing translations remain readable.', 'Les traductions manquantes restent lisibles.'],
    [
      'Built to test the edges of a small, composable i18n API.',
      'Conçu pour tester les limites d’une API i18n petite et composable.',
    ],
  ].map(([id, translation]) => ({ id, translation })),
  'fr-CA': [],
};

export const loadExampleCatalog = ({ languageId }: { languageId: string; }): TranslationItem[] =>
  catalogs[languageId] ?? [];
