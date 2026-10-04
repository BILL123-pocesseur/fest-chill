/* ============================================================
   FEST&CHILL — ADMIN : code commun à toutes les pages admin
   Sur une page donnée, seules certaines sections existent : tout élément
   absent est remplacé par un élément vide (ainsi un chargeur n'écrit
   jamais dans le vide et ne plante pas).
   ============================================================ */
(function(){
  const real = document.getElementById.bind(document);
  document.getElementById = function(id){ return real(id) || document.createElement('div'); };
})();

const FCI = {
  'check': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"20 6 9 17 4 12\"/></svg>",
  'check-circle': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><polyline points=\"8 12.5 10.8 15.3 16 9.5\"/></svg>",
  'x-circle': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><line x1=\"9\" y1=\"9\" x2=\"15\" y2=\"15\"/><line x1=\"15\" y1=\"9\" x2=\"9\" y2=\"15\"/></svg>",
  'x': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/><line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/></svg>",
  'smartphone': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"7\" y=\"2.5\" width=\"10\" height=\"19\" rx=\"2.2\"/><line x1=\"11\" y1=\"18.3\" x2=\"13\" y2=\"18.3\"/></svg>",
  'ticket': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 9.5V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.5a2 2 0 0 0 0 4V16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2.5a2 2 0 0 0 0-4Z\"/><line x1=\"10\" y1=\"6\" x2=\"10\" y2=\"18\" stroke-dasharray=\"2 2.4\"/></svg>",
  'star': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 3.5 14.6 9.1 20.8 9.9 16.3 14.1 17.5 20.2 12 17.1 6.5 20.2 7.7 14.1 3.2 9.9 9.4 9.1Z\"/></svg>",
  'download': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 3.5v11.5\"/><polyline points=\"7.5 11 12 15.5 16.5 11\"/><path d=\"M4.5 17.5v1.7a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-1.7\"/></svg>",
  'upload': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 20.5V9\"/><polyline points=\"7.5 13 12 8.5 16.5 13\"/><path d=\"M4.5 17.5v1.7a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-1.7\"/></svg>",
  'cash': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"2.5\" y=\"6.5\" width=\"19\" height=\"11\" rx=\"2\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/><line x1=\"6\" y1=\"9.3\" x2=\"6\" y2=\"9.3\"/><line x1=\"18\" y1=\"14.7\" x2=\"18\" y2=\"14.7\"/></svg>",
  'calendar': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3.5\" y=\"5\" width=\"17\" height=\"16\" rx=\"2.2\"/><line x1=\"3.5\" y1=\"10\" x2=\"20.5\" y2=\"10\"/><line x1=\"8\" y1=\"3\" x2=\"8\" y2=\"7\"/><line x1=\"16\" y1=\"3\" x2=\"16\" y2=\"7\"/></svg>",
  'settings': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"3.2\"/><path d=\"M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2.06 2.06 0 1 1-2.92 2.92l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56v.17a2.06 2.06 0 1 1-4.12 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2.06 2.06 0 1 1-2.92-2.92l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03h-.17a2.06 2.06 0 1 1 0-4.12h.09a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2.06 2.06 0 1 1 2.92-2.92l.06.06a1.7 1.7 0 0 0 1.87.34h.08a1.7 1.7 0 0 0 1.03-1.56v-.17a2.06 2.06 0 1 1 4.12 0v.09a1.7 1.7 0 0 0 1.03 1.56h.08a1.7 1.7 0 0 0 1.87-.34l.06-.06a2.06 2.06 0 1 1 2.92 2.92l-.06.06a1.7 1.7 0 0 0-.34 1.87v.08a1.7 1.7 0 0 0 1.56 1.03h.17a2.06 2.06 0 1 1 0 4.12h-.09a1.7 1.7 0 0 0-1.56 1.03Z\"/></svg>",
  'lock': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"4.5\" y=\"10.5\" width=\"15\" height=\"10\" rx=\"2.2\"/><path d=\"M7.5 10.5V7.2a4.5 4.5 0 0 1 9 0v3.3\"/></svg>",
  'wallet': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 7.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z\"/><path d=\"M17 11.5h2.5a1.5 1.5 0 0 1 1.5 1.5v1a1.5 1.5 0 0 1-1.5 1.5H17a2 2 0 0 1 0-4Z\"/><line x1=\"3\" y1=\"8.7\" x2=\"21\" y2=\"8.7\"/></svg>",
  'plus': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><line x1=\"12\" y1=\"5\" x2=\"12\" y2=\"19\"/><line x1=\"5\" y1=\"12\" x2=\"19\" y2=\"12\"/></svg>",
  'camera': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 8.2A1.7 1.7 0 0 1 5.7 6.5h2.1l1-1.7h6.4l1 1.7h2.1A1.7 1.7 0 0 1 20 8.2v9.1a1.7 1.7 0 0 1-1.7 1.7H5.7A1.7 1.7 0 0 1 4 17.3Z\"/><circle cx=\"12\" cy=\"12.4\" r=\"3.4\"/></svg>",
  'bar-chart': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><line x1=\"5\" y1=\"20\" x2=\"5\" y2=\"11\"/><line x1=\"12\" y1=\"20\" x2=\"12\" y2=\"5\"/><line x1=\"19\" y1=\"20\" x2=\"19\" y2=\"14\"/></svg>",
  'alert-triangle': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 4 21.5 20H2.5Z\" stroke-linejoin=\"round\"/><line x1=\"12\" y1=\"10\" x2=\"12\" y2=\"14.5\"/><line x1=\"12\" y1=\"17.3\" x2=\"12\" y2=\"17.3\"/></svg>",
  'clipboard': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"5.5\" y=\"5\" width=\"13\" height=\"16\" rx=\"2\"/><rect x=\"9\" y=\"3\" width=\"6\" height=\"3.4\" rx=\"1\"/></svg>",
  'home': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 11.5 12 4l8 7.5\"/><path d=\"M6 10v9.5a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1V10\"/></svg>",
  'trending-up': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"4 16 10 10 14 14 20 6\"/><polyline points=\"14.5 6 20 6 20 11.5\"/></svg>",
  'refresh': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12a8 8 0 0 1 13.66-5.66L20 8.5\"/><polyline points=\"20 4 20 8.5 15.5 8.5\"/><path d=\"M20 12a8 8 0 0 1-13.66 5.66L4 15.5\"/><polyline points=\"4 20 4 15.5 8.5 15.5\"/></svg>",
  'music': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 18.3a2.7 2.7 0 1 1-2.7-2.7A2.7 2.7 0 0 1 9 18.3Z\"/><path d=\"M19 16.3a2.7 2.7 0 1 1-2.7-2.7 2.7 2.7 0 0 1 2.7 2.7Z\"/><path d=\"M9 18.3V6.5l10-2v11.8\"/></svg>",
  'siren': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 15a6 6 0 0 1 12 0v2H6Z\"/><line x1=\"4\" y1=\"20\" x2=\"20\" y2=\"20\"/><line x1=\"12\" y1=\"6\" x2=\"12\" y2=\"3.5\"/><line x1=\"7\" y1=\"7.5\" x2=\"5.5\" y2=\"6\"/><line x1=\"17\" y1=\"7.5\" x2=\"18.5\" y2=\"6\"/></svg>",
  'message-circle': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12a8 8 0 1 1 3.5 6.6L4 20l1.3-3.6A7.96 7.96 0 0 1 4 12Z\"/></svg>",
  'search': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"10.5\" cy=\"10.5\" r=\"6.5\"/><line x1=\"15.3\" y1=\"15.3\" x2=\"20.5\" y2=\"20.5\"/></svg>",
  'edit': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14 5.5 18.5 10 8 20.5H3.5V16Z\"/><line x1=\"12\" y1=\"7.5\" x2=\"16.5\" y2=\"12\"/></svg>",
  'user': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"8\" r=\"3.6\"/><path d=\"M4.5 20a7.5 7.5 0 0 1 15 0\"/></svg>",
  'users': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"9\" cy=\"8.2\" r=\"3.2\"/><path d=\"M3 19a6 6 0 0 1 12 0\"/><path d=\"M15.5 5.5a3.2 3.2 0 0 1 0 6.2\"/><path d=\"M17 13a6 6 0 0 1 4 5.6\"/></svg>",
  'file': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6.5 3.5h7l4 4V20a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z\"/><polyline points=\"13.5 3.5 13.5 7.5 17.5 7.5\"/></svg>",
  'map-pin': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 21s7-6.4 7-11.6A7 7 0 0 0 5 9.4C5 14.6 12 21 12 21Z\"/><circle cx=\"12\" cy=\"9.4\" r=\"2.4\"/></svg>",
  'printer': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"5\" y=\"8.5\" width=\"14\" height=\"7.5\" rx=\"1.5\"/><path d=\"M7.5 8.5V4h9v4.5\"/><path d=\"M7.5 15.5v4.5h9v-4.5\"/></svg>",
  'bell': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 10.5a6 6 0 0 1 12 0c0 4 1.3 5.4 1.9 6H4.1c.6-.6 1.9-2 1.9-6Z\"/><path d=\"M10.2 19.5a1.9 1.9 0 0 0 3.6 0\"/></svg>",
  'palette': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><circle cx=\"8.2\" cy=\"10\" r=\"1.15\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"12\" cy=\"7.5\" r=\"1.15\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"16\" cy=\"10\" r=\"1.15\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"9.5\" cy=\"14.7\" r=\"1.15\" fill=\"currentColor\" stroke=\"none\"/><path d=\"M15 15.2a2.2 2.2 0 0 0 2.2 2.2c1.6 0 2.8-.9 2.8-2.6A9 9 0 1 0 12 21\"/></svg>",
  'sun': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"4.3\"/><line x1=\"12\" y1=\"2.5\" x2=\"12\" y2=\"4.5\"/><line x1=\"12\" y1=\"19.5\" x2=\"12\" y2=\"21.5\"/><line x1=\"4.2\" y1=\"4.2\" x2=\"5.6\" y2=\"5.6\"/><line x1=\"18.4\" y1=\"18.4\" x2=\"19.8\" y2=\"19.8\"/><line x1=\"2.5\" y1=\"12\" x2=\"4.5\" y2=\"12\"/><line x1=\"19.5\" y1=\"12\" x2=\"21.5\" y2=\"12\"/><line x1=\"4.2\" y1=\"19.8\" x2=\"5.6\" y2=\"18.4\"/><line x1=\"18.4\" y1=\"5.6\" x2=\"19.8\" y2=\"4.2\"/></svg>",
  'moon': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20 14.3A8.5 8.5 0 1 1 9.7 4a6.7 6.7 0 0 0 10.3 10.3Z\"/></svg>",
  'credit-card': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"2.5\" y=\"5.5\" width=\"19\" height=\"13\" rx=\"2.2\"/><line x1=\"2.5\" y1=\"9.8\" x2=\"21.5\" y2=\"9.8\"/><line x1=\"6\" y1=\"14.5\" x2=\"10\" y2=\"14.5\"/></svg>",
  'trophy': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 4.5h10v5a5 5 0 0 1-10 0Z\"/><path d=\"M7 6H4.5A2.5 2.5 0 0 0 6 10.5\"/><path d=\"M17 6h2.5A2.5 2.5 0 0 1 18 10.5\"/><line x1=\"12\" y1=\"14.5\" x2=\"12\" y2=\"18\"/><line x1=\"8.5\" y1=\"21\" x2=\"15.5\" y2=\"21\"/><line x1=\"12\" y1=\"18\" x2=\"12\" y2=\"21\"/></svg>",
  'medal': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"14.5\" r=\"5.2\"/><path d=\"M12 11.5 13 14.2h2.8l-2.3 1.7.9 2.7-2.4-1.7-2.4 1.7.9-2.7-2.3-1.7H11Z\" fill=\"currentColor\" stroke=\"none\"/><path d=\"M9 8.5 6 3h3l2.2 4.3\"/><path d=\"M15 8.5 18 3h-3l-2.2 4.3\"/></svg>",
  'party': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 20 14.5 4.8c.5-.7 1.6-.4 1.7.4l1.6 12a1 1 0 0 1-1.3 1.1L4 20Z\"/><line x1=\"8\" y1=\"4\" x2=\"9\" y2=\"5.6\"/><line x1=\"3\" y1=\"9\" x2=\"4.8\" y2=\"9.6\"/><line x1=\"18\" y1=\"2.5\" x2=\"18\" y2=\"4.2\"/></svg>",
  'arrow-left': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><line x1=\"19\" y1=\"12\" x2=\"5\" y2=\"12\"/><polyline points=\"10.5 6 5 12 10.5 18\"/></svg>",
  'arrow-up': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><line x1=\"12\" y1=\"19\" x2=\"12\" y2=\"5\"/><polyline points=\"6 10.5 12 5 18 10.5\"/></svg>",
  'arrow-down': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><line x1=\"12\" y1=\"5\" x2=\"12\" y2=\"19\"/><polyline points=\"6 13.5 12 19 18 13.5\"/></svg>",
  'link': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9.5 14.5 14.5 9.5\"/><path d=\"M11 6.3 13 4.3a3.9 3.9 0 0 1 5.5 5.5l-2 2\"/><path d=\"M13 17.7 11 19.7a3.9 3.9 0 0 1-5.5-5.5l2-2\"/></svg>",
  'thumbs-up': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 11v9H4.5A1.5 1.5 0 0 1 3 18.5v-6A1.5 1.5 0 0 1 4.5 11Z\"/><path d=\"M7 11l4-7.5a2 2 0 0 1 3.6 1.7L13.3 9H18a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 16.6 20H9.5A2.5 2.5 0 0 1 7 17.5\"/></svg>",
  'ban': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><line x1=\"6\" y1=\"18\" x2=\"18\" y2=\"6\"/></svg>",
  'tent': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 4 21 19H3Z\"/><path d=\"M12 4v15\"/><path d=\"M8 19 12 11l4 8\"/></svg>",
  'building': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"5\" y=\"3.5\" width=\"14\" height=\"17\" rx=\"1\"/><line x1=\"8.5\" y1=\"7.5\" x2=\"8.5\" y2=\"7.5\"/><line x1=\"12\" y1=\"7.5\" x2=\"12\" y2=\"7.5\"/><line x1=\"15.5\" y1=\"7.5\" x2=\"15.5\" y2=\"7.5\"/><line x1=\"8.5\" y1=\"11\" x2=\"8.5\" y2=\"11\"/><line x1=\"12\" y1=\"11\" x2=\"12\" y2=\"11\"/><line x1=\"15.5\" y1=\"11\" x2=\"15.5\" y2=\"11\"/><line x1=\"8.5\" y1=\"14.5\" x2=\"8.5\" y2=\"14.5\"/><line x1=\"15.5\" y1=\"14.5\" x2=\"15.5\" y2=\"14.5\"/><rect x=\"10\" y=\"16\" width=\"4\" height=\"4.5\"/></svg>",
  'church': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><line x1=\"12\" y1=\"2.5\" x2=\"12\" y2=\"6.5\"/><line x1=\"10\" y1=\"4.2\" x2=\"14\" y2=\"4.2\"/><path d=\"M12 6.5 20 12.5v8H4v-8Z\"/><rect x=\"10\" y=\"15\" width=\"4\" height=\"5.5\"/></svg>",
  'graduation-cap': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2.5 9.5 12 5l9.5 4.5L12 14Z\"/><path d=\"M6.5 11.7v4.3c0 1.4 2.5 2.8 5.5 2.8s5.5-1.4 5.5-2.8v-4.3\"/><line x1=\"21.5\" y1=\"9.5\" x2=\"21.5\" y2=\"15.5\"/></svg>",
  'briefcase': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"7.5\" width=\"18\" height=\"12\" rx=\"2\"/><path d=\"M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5\"/><line x1=\"3\" y1=\"12.5\" x2=\"21\" y2=\"12.5\"/></svg>",
  'undo': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8 8.5H4.5V5\"/><path d=\"M4.5 8.5A8 8 0 1 1 6 16\"/></svg>",
  'key': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"8\" cy=\"15\" r=\"4.2\"/><path d=\"M11 12 19 4\"/><path d=\"M15.5 7.5 18 10\"/><path d=\"M18.5 4.5 21 7\"/></svg>",
  'mail': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"5.5\" width=\"18\" height=\"13\" rx=\"2\"/><polyline points=\"3.5 6.5 12 13 20.5 6.5\"/></svg>",
  'laptop': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"4.5\" y=\"5\" width=\"15\" height=\"10\" rx=\"1.3\"/><path d=\"M2.5 19.5h19l-2-3h-15Z\"/></svg>",
  'help-circle': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M9.3 9.3a2.7 2.7 0 1 1 3.9 2.4c-.9.5-1.2 1-1.2 2\"/><line x1=\"12\" y1=\"16.8\" x2=\"12\" y2=\"16.8\"/></svg>",
  'trash': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><line x1=\"4.5\" y1=\"7\" x2=\"19.5\" y2=\"7\"/><path d=\"M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2\"/><path d=\"M6.5 7 7.3 19a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9L17.5 7\"/></svg>",
  'scan': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8\"/><path d=\"M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8\"/><path d=\"M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16\"/><path d=\"M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16\"/><line x1=\"4\" y1=\"12\" x2=\"20\" y2=\"12\"/></svg>",
  'external-link': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 13.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5.5\"/><polyline points=\"15 3 21 3 21 9\"/><line x1=\"10\" y1=\"14\" x2=\"21\" y2=\"3\"/></svg>",
  'chevron-right': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"9 5.5 15.5 12 9 18.5\"/></svg>",
  'eye': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z\"/><circle cx=\"12\" cy=\"12\" r=\"2.8\"/></svg>",
  'shield': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 3 20 6.5v5.7c0 5-3.4 8.3-8 9.8-4.6-1.5-8-4.8-8-9.8V6.5Z\"/><polyline points=\"8.5 12 11 14.5 15.5 9.5\"/></svg>",
  'info': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><line x1=\"12\" y1=\"11\" x2=\"12\" y2=\"16.5\"/><line x1=\"12\" y1=\"7.5\" x2=\"12\" y2=\"7.5\"/></svg>",
  'filter': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polygon points=\"3.5 4.5 20.5 4.5 14 12.5 14 19 10 21 10 12.5\"/></svg>",
  'logout': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M15 4.5H7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8\"/><line x1=\"10\" y1=\"12\" x2=\"21\" y2=\"12\"/><polyline points=\"17 8 21 12 17 16\"/></svg>",
  'pause': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"6\" y=\"4.5\" width=\"4\" height=\"15\" rx=\"1\"/><rect x=\"14\" y=\"4.5\" width=\"4\" height=\"15\" rx=\"1\"/></svg>",
  'clock': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><polyline points=\"12 7 12 12 16 14\"/></svg>",
  'play': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8 5.5 19 12 8 18.5Z\" stroke-linejoin=\"round\"/></svg>",
  'stop': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"6\" y=\"6\" width=\"12\" height=\"12\" rx=\"2\"/></svg>",
  'qr': "<svg class=\"icn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3.5\" y=\"3.5\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"13.5\" y=\"3.5\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"3.5\" y=\"13.5\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"6\" y=\"6\" width=\"2\" height=\"2\" fill=\"currentColor\" stroke=\"none\"/><rect x=\"16\" y=\"6\" width=\"2\" height=\"2\" fill=\"currentColor\" stroke=\"none\"/><rect x=\"6\" y=\"16\" width=\"2\" height=\"2\" fill=\"currentColor\" stroke=\"none\"/><rect x=\"14\" y=\"14\" width=\"3\" height=\"3\"/><rect x=\"18.5\" y=\"14\" width=\"2\" height=\"2\" fill=\"currentColor\" stroke=\"none\"/><rect x=\"14\" y=\"18.5\" width=\"2\" height=\"2\" fill=\"currentColor\" stroke=\"none\"/><rect x=\"18.5\" y=\"18.5\" width=\"2\" height=\"2\" fill=\"currentColor\" stroke=\"none\"/></svg>",
  'dot-red': '<span class="dot" style="background:var(--red)"></span>',
  'dot-green': '<span class="dot" style="background:var(--green)"></span>',
  'dot-gold': '<span class="dot" style="background:var(--gold)"></span>',
  'dot-teal': '<span class="dot" style="background:var(--purple)"></span>',
};

// Count-up animation — only touches leading text node, preserves nested spans (e.g. "FCFA")
function fcCountUp(el){
  const node = [...el.childNodes].find(n=>n.nodeType===3 && n.textContent.trim());
  const target_el = node ? el : null;
  const raw = node ? node.textContent : el.textContent.trim();
  const m = raw.match(/([\d.,\s]+)/);
  if(!m) return;
  const target = parseFloat(m[1].replace(/[,\s]/g,''));
  if(isNaN(target)) return;
  const before = raw.slice(0, m.index), after = raw.slice(m.index + m[1].length);
  let cur = 0;
  const step = Math.max(target/32,0.5);
  const iv = setInterval(()=>{
    cur += step;
    const val = cur>=target ? (Number.isInteger(target)?target:Math.round(target*10)/10) : Math.round(cur);
    const text = before + val.toLocaleString('fr-FR') + after;
    if(node) node.textContent = text; else el.textContent = text;
    if(cur>=target) clearInterval(iv);
  },20);
}
let adminProfile = null;

async function boot(){
  adminProfile = await fcRequireAuth({ adminOnly: true });
  if (!adminProfile) return;
  fcMountSidebar(adminProfile);
  document.getElementById('side-name').textContent = adminProfile.full_name || fcT('admin.title');
  await loadAll();
}

async function loadAll(){
  document.getElementById('last-update').textContent = fcT('admin.last_update') + ' : ' + fcFormatTime();
  await Promise.allSettled([loadStats(), loadEvents(), loadOrders(), loadOrganizers(), loadConfig(), loadAlerts(), loadChart(), loadAdminCommissionBalance(), loadCertificationCandidates()]);
  document.querySelectorAll('.stat-num').forEach(fcCountUp);
}

async function loadAdminCommissionBalance(){
  try {
    const balance = await fcGetAdminCommissionBalance();
    document.getElementById('admin-commission-balance').textContent = fcFormatFCFA(balance);
    try {
      const { data: bd } = await supa.rpc('fc_get_admin_balance_breakdown');
      if (bd) document.getElementById('admin-balance-detail').innerHTML =
        'Commissions : <b>' + fcFormatFCFA(bd.commissions) + '</b> · Mises à la une : <b>' + fcFormatFCFA(bd.featured) + '</b> · Déjà retiré : <b>' + fcFormatFCFA(bd.withdrawn) + '</b>';
    } catch(e2) {}
  } catch(e) {
    document.getElementById('admin-commission-balance').textContent = '—';
  }
}

function openAdminWithdrawModal(){
  document.getElementById('admin-wd-amount').value = '';
  document.getElementById('admin-wd-phone').value = '';
  document.getElementById('admin-wd-modal').classList.add('open');
}
function closeAdminWithdrawModal(){
  document.getElementById('admin-wd-modal').classList.remove('open');
}

async function processAdminWithdraw(){
  const amount = parseInt(document.getElementById('admin-wd-amount').value) || 0;
  const phone = document.getElementById('admin-wd-phone').value.trim();
  const operator = document.getElementById('admin-wd-operator').value;

  if (!phone){ showToast('Entre un numéro Mobile Money', FCI['alert-triangle']); return; }
  if (amount < 1000){ showToast('Montant minimum : 1 000 FCFA', FCI['alert-triangle']); return; }

  let pin = null;
  try {
    const st = await fcGetPinStatus();
    if (st.locked) { showToast(st.message, FCI['lock']); return; }
    if (!st.enabled) {
      const vals = await fcAskPin({
        title: 'Crée ton code PIN',
        subtitle: 'Obligatoire pour sécuriser tes retraits. Choisis 5 chiffres que toi seul connais.',
        fields: [{ label: 'Nouveau code PIN' }, { label: 'Confirme le code PIN' }],
        confirmLabel: 'Créer mon code PIN',
        confirmMatch: true
      });
      if (!vals) return;
      await fcSetWithdrawalPin(vals[0]);
      pin = vals[0];
      showToast('Code PIN créé avec succès !', FCI['check-circle']);
    } else {
      const vals = await fcAskPin({ title: 'Confirme avec ton code PIN', fields: [{ label: 'Code PIN' }], confirmLabel: 'Confirmer le retrait' });
      if (!vals) return;
      pin = vals[0];
    }
  } catch(e) { showToast(e.message || 'Erreur PIN', FCI['x-circle']); return; }

  closeAdminWithdrawModal();
  try {
    await fcRequestAdminWithdrawal(amount, operator, phone, pin);
    showToast('Retrait envoyé — l\'argent arrive sous peu !', FCI['check-circle']);
    await loadAdminCommissionBalance();
  } catch(e) {
    showToast('Erreur : ' + e.message, FCI['x-circle']);
  }
}

async function loadStats(){
  const { count: organizersCount } = await supa.from('profiles').select('id',{count:'exact',head:true}).eq('role','organizer');
  const { count: eventsCount } = await supa.from('events').select('id',{count:'exact',head:true}).eq('status','published');
  const { count: ticketsCount } = await supa.from('tickets').select('id',{count:'exact',head:true}).neq('status','cancelled');
  const { data: paidOrders } = await supa.from('orders').select('amount').eq('payment_status','paid');
  const { data: withdrawals } = await supa.from('withdrawals').select('amount,status');
  const { data: cfg } = await supa.from('platform_config').select('*').eq('id',1).single();

  const gross = (paidOrders||[]).reduce((s,o)=>s+o.amount,0);
  const rate = cfg?.commission_rate ?? 10;
  const commission = Math.round(gross * rate / 100);
  const withdrawn = (withdrawals||[]).filter(w=>w.status==='confirmed').reduce((s,w)=>s+w.amount,0);

  document.getElementById('stat-organizers').textContent = organizersCount ?? 0;
  document.getElementById('stat-organizers-sub').textContent = fcT('admin.total_registered');
  document.getElementById('stat-revenue').textContent = fcFormatFCFA(commission).replace(' FCFA','');
  document.getElementById('stat-tickets').textContent = (ticketsCount ?? 0).toLocaleString('fr-FR');
  document.getElementById('stat-events').textContent = eventsCount ?? 0;
  document.getElementById('stat-events-sub').textContent = fcT('admin.currently_selling');

  document.getElementById('comm-total').textContent = fcFormatFCFA(commission);
  document.getElementById('comm-rate-txt').textContent = fcT('admin.rate_label') + ' : ' + rate + '%';
  document.getElementById('comm-gross').textContent = fcFormatFCFA(gross);
  document.getElementById('comm-orders-count').textContent = (paidOrders||[]).length + ' ' + fcT('admin.paid_orders');
  document.getElementById('comm-withdrawn').textContent = fcFormatFCFA(withdrawn);
  document.getElementById('comm-withdraw-count').textContent = (withdrawals||[]).filter(w=>w.status==='confirmed').length + ' ' + fcT('admin.confirmed_withdrawals');
}

async function loadEvents(){
  const { data: events, error } = await supa
    .from('events')
    .select('id, title, event_date, location, status, profiles(full_name), ticket_categories(quota, sold, price)')
    .order('event_date', { ascending: false })
    .limit(20);

  const { data: cfg } = await supa.from('platform_config').select('commission_rate').eq('id',1).single();
  const rate = cfg?.commission_rate ?? 10;

  const tbody = document.getElementById('events-tbody');
  if (error || !events || !events.length){
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--muted)">${fcT('dashboard.no_events').replace('<br>','')}</td></tr>`;
    return;
  }

  const statusBadge = { published: '<span class="badge b-green">'+fcT('status.published')+'</span>', draft: '<span class="badge b-purple">'+fcT('status.draft')+'</span>', suspended: '<span class="badge b-red">'+fcT('status.suspended')+'</span>', ended: '<span class="badge b-gray">'+fcT('status.ended')+'</span>' };

  tbody.innerHTML = events.map(e => {
    const quota = (e.ticket_categories||[]).reduce((s,c)=>s+c.quota,0);
    const sold = (e.ticket_categories||[]).reduce((s,c)=>s+c.sold,0);
    const revenue = (e.ticket_categories||[]).reduce((s,c)=>s+c.sold*c.price,0);
    const commission = Math.round(revenue*rate/100);
    return `<tr>
      <td><div style="font-weight:600;color:var(--text)">${e.title}</div><div style="font-size:.72rem;color:var(--muted)">${fcFormatDate(e.event_date)} · ${e.location||''}</div></td>
      <td>${e.profiles?.full_name || '—'}</td>
      <td><span style="font-weight:700">${sold}</span>/${quota}</td>
      <td style="color:var(--gold);font-weight:700">${fcFormatFCFA(revenue)}</td>
      <td style="color:var(--green);font-weight:700">${fcFormatFCFA(commission)}</td>
      <td>${statusBadge[e.status] || e.status}</td>
      <td>${e.status==='published'
          ? `<button class="btn btn-danger btn-sm" onclick="suspendEvent('${e.id}')">${fcT('admin.suspend')}</button>`
          : e.status==='suspended'
          ? `<button class="btn btn-success btn-sm" onclick="republishEvent('${e.id}')">${fcT('admin.republish')}</button>`
          : ''}</td>
    </tr>`;
  }).join('');
}

async function suspendEvent(id){
  await supa.from('events').update({ status: 'suspended' }).eq('id', id);
  showToast(fcT('admin.event_suspended'), FCI['pause']);
  loadEvents();
}
async function republishEvent(id){
  await supa.from('events').update({ status: 'published' }).eq('id', id);
  showToast(fcT('admin.event_republished'), FCI['check-circle']);
  loadEvents();
}

async function loadOrders(){
  const { data: orders, error } = await supa
    .from('orders')
    .select('id, amount, payment_operator, payment_status, events(title, profiles(full_name))')
    .order('created_at', { ascending: false })
    .limit(10);

  const tbody = document.getElementById('orders-tbody');
  if (error || !orders || !orders.length){
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--muted)">${fcT('admin.no_orders_yet')}</td></tr>`;
    return;
  }
  const statusBadge = { paid: '<span class="badge b-green">'+fcT('status.paid')+'</span>', pending: '<span class="badge b-gold">'+fcT('status.pending')+'</span>', failed: '<span class="badge b-red">'+fcT('status.failed')+'</span>' };
  tbody.innerHTML = orders.map(o => `<tr>
    <td style="color:var(--muted);font-size:.72rem">${o.id.slice(0,8)}</td>
    <td>${o.events?.profiles?.full_name || '—'}</td>
    <td>${fcT('wallet.ticket_sale')}</td>
    <td style="color:var(--green);font-weight:700">+${fcFormatFCFA(o.amount)}</td>
    <td>${o.payment_operator ? o.payment_operator.toUpperCase() : '—'}</td>
    <td>${statusBadge[o.payment_status] || o.payment_status}</td>
  </tr>`).join('');
}

async function loadCertificationCandidates(){
  try {
    await supa.rpc('fc_check_certification_candidates');
  } catch(e) {}
  const { data } = await supa.rpc('fc_list_certification_candidates');
  const card = document.getElementById('sec-certification');
  const list = document.getElementById('certification-list');
  if (!data || !data.length){ card.style.display = 'none'; return; }
  card.style.display = 'block';
  list.innerHTML = data.map(c => `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px 18px;border-top:1px solid var(--border)">
      <div>
        <div style="font-weight:700;font-size:.88rem">${c.full_name || '—'}</div>
        <div style="font-size:.76rem;color:var(--muted)">${c.email} · ${c.published_events} événements · ${c.total_sold} tickets vendus</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn btn-primary btn-sm" onclick="certifyOrganizer('${c.id}', true)">Certifier</button>
        <button class="btn btn-ghost btn-sm" onclick="certifyOrganizer('${c.id}', false)">Ignorer</button>
      </div>
    </div>
  `).join('');
}

async function certifyOrganizer(id, certify){
  try {
    await supa.rpc('fc_certify_organizer', { p_organizer_id: id, p_certify: certify });
    showToast(certify ? 'Organisateur certifié !' : 'Candidat ignoré', FCI['check-circle']);
    loadCertificationCandidates();
  } catch(e) { showToast('Erreur : ' + e.message, FCI['x-circle']); }
}

async function loadOrganizers(){
  const { data: organizers, error } = await supa
    .from('profiles')
    .select('id, full_name, is_verified, status, created_at, events(id, ticket_categories(sold, price))')
    .eq('role','organizer')
    .order('created_at', { ascending: false });

  const top = document.getElementById('top-organizers');
  const recent = document.getElementById('recent-organizers');
  const btn = document.getElementById('organizers-count-btn');
  if (btn) btn.textContent = fcT('admin.see_all') + ' (' + (organizers?.length||0) + ')';

  if (error || !organizers || !organizers.length){
    top.innerHTML = `<div style="padding:20px;text-align:center;color:var(--muted);font-size:.85rem">${fcT('admin.no_organizers_yet')}</div>`;
    recent.innerHTML = `<div style="padding:20px;text-align:center;color:var(--muted);font-size:.85rem">${fcT('admin.no_organizers_yet')}</div>`;
    return;
  }

  const withRevenue = organizers.map(o => {
    const events = o.events || [];
    const revenue = events.reduce((s,e)=> s + (e.ticket_categories||[]).reduce((s2,c)=>s2+c.sold*c.price,0), 0);
    return { ...o, eventCount: events.length, revenue };
  }).sort((a,b)=>b.revenue-a.revenue);

  top.innerHTML = withRevenue.slice(0,4).map((o,i) => `
    <div class="user-row">
      <div class="u-avatar">${(o.full_name||'??').slice(0,2).toUpperCase()}</div>
      <div class="u-info"><div class="u-name">${o.full_name||fcT('admin.no_name')}</div><div class="u-sub">${o.eventCount} ${o.eventCount>1?fcT('admin.events_plural'):fcT('admin.event_singular')} · ${fcFormatFCFA(o.revenue)}</div></div>
      ${i===0 ? `<span class="badge b-gold">${FCI['medal']}</span>` : `<span style="font-size:.8rem;color:var(--muted);font-weight:700">#${i+1}</span>`}
    </div>`).join('');

  const recentSorted = [...organizers].sort((a,b)=> new Date(b.created_at) - new Date(a.created_at)).slice(0,6);
  recent.innerHTML = recentSorted.map(o => `
    <div class="user-row">
      <div class="u-avatar">${(o.full_name||'??').slice(0,2).toUpperCase()}</div>
      <div class="u-info"><div class="u-name">${o.full_name||fcT('admin.no_name')}</div><div class="u-sub">${fcT('admin.registered_on')} ${fcFormatDate(o.created_at)} · ${o.is_verified?fcT('admin.verified'):fcT('admin.not_verified')}</div></div>
      <div class="u-actions">
        ${(o.status==='suspended' || o.status==='blocked')
          ? `<button class="btn btn-success btn-sm" onclick="setOrganizerStatus('${o.id}','active')">${fcT('admin.reactivate')}</button>`
          : `${!o.is_verified ? `<button class="btn btn-success btn-sm" onclick="verifyOrganizer('${o.id}')">${FCI['check']}</button>` : '<span class="badge b-green">'+fcT('status.active')+'</span>'}
             <button class="btn btn-danger btn-sm" onclick="setOrganizerStatus('${o.id}','suspended')">${FCI['x']}</button>`}
      </div>
    </div>`).join('');
}

async function verifyOrganizer(id){
  await supa.from('profiles').update({ is_verified: true }).eq('id', id);
  showToast(fcT('admin.account_verified'), FCI['check-circle']);
  loadOrganizers();
}
async function setOrganizerStatus(id, status){
  try { await fcAdminSetBlocked(id, status === 'suspended'); }
  catch(e){ showToast('Erreur : ' + e.message, FCI['x-circle']); return; }
  showToast(status==='suspended' ? fcT('admin.account_blocked') : fcT('admin.account_reactivated'), status==='suspended' ? FCI['lock'] : FCI['check-circle']);
  loadOrganizers();
}

async function loadConfig(){
  const { data: cfg } = await supa.from('platform_config').select('*').eq('id',1).single();
  if (!cfg) return;
  document.getElementById('cfg-commission').value = cfg.commission_rate;
  document.getElementById('cfg-fee-small').value = cfg.fee_small;
  document.getElementById('cfg-fee-medium').value = cfg.fee_medium;
  document.getElementById('cfg-fee-large').value = cfg.fee_large;
}

async function saveConfig(){
  const { error } = await supa.from('platform_config').update({
    commission_rate: parseFloat(document.getElementById('cfg-commission').value),
    fee_small: parseInt(document.getElementById('cfg-fee-small').value),
    fee_medium: parseInt(document.getElementById('cfg-fee-medium').value),
    fee_large: parseInt(document.getElementById('cfg-fee-large').value),
  }).eq('id',1);
  if (error){ showToast('Erreur : ' + error.message, FCI['x-circle']); return; }
  showToast(fcT('admin.config_saved'), FCI['check-circle']);
  loadStats();
}

async function loadAlerts(){
  const zone = document.getElementById('alerts-zone');
  const alerts = [];
  const { data: pendingWithdrawals } = await supa.from('withdrawals').select('id, amount, created_at, profiles(full_name)').eq('status','pending');
  (pendingWithdrawals||[]).forEach(w => {
    alerts.push(`<div class="alert warning"><span class="alert-icon">${FCI['alert-triangle']}</span><div class="alert-text"><div class="alert-title">${fcT('admin.pending_withdrawal')} — ${w.profiles?.full_name||fcT('admin.default_organizer')}</div><div class="alert-sub">${fcT('admin.withdrawal_request_of')} ${fcFormatFCFA(w.amount)}</div></div></div>`);
  });
  const { data: unverified } = await supa.from('profiles').select('id, full_name').eq('role','organizer').eq('is_verified', false).limit(3);
  (unverified||[]).forEach(u => {
    alerts.push(`<div class="alert info"><span class="alert-icon">${FCI['info']}</span><div class="alert-text"><div class="alert-title">${fcT('admin.new_unverified_organizer')}</div><div class="alert-sub">${u.full_name||fcT('admin.no_name')} — ${fcT('admin.pending_verification')}</div></div><button class="btn btn-primary btn-sm" onclick="verifyOrganizer('${u.id}')">${fcT('admin.verify')}</button></div>`);
  });
  zone.innerHTML = alerts.length ? alerts.join('') : '';
}

async function loadChart(){
  const { data: paidOrders } = await supa.from('orders').select('amount, created_at').eq('payment_status','paid');
  const { data: cfg } = await supa.from('platform_config').select('commission_rate').eq('id',1).single();
  const rate = cfg?.commission_rate ?? 10;

  const days = [...Array(30)].map((_,i)=>{
    const d = new Date(); d.setDate(d.getDate() - (29-i)); d.setHours(0,0,0,0); return d;
  });
  const data = days.map(d => {
    const next = new Date(d); next.setDate(next.getDate()+1);
    const grossDay = (paidOrders||[]).filter(o => { const t = new Date(o.created_at); return t >= d && t < next; }).reduce((s,o)=>s+o.amount,0);
    return Math.round(grossDay * rate / 100);
  });
  const max = Math.max(1, ...data);
  const chart = document.getElementById('admin-chart');
  chart.innerHTML = '';
  data.forEach((v,i)=>{
    const w = document.createElement('div');
    w.className = 'bar-w';
    const b = document.createElement('div');
    b.className = 'bar-b';
    const h = Math.max(3, v/max*100);
    b.style.cssText = `height:${h}px;background:linear-gradient(180deg,#F59E0B,#D97706);border-radius:3px 3px 0 0`;
    b.title = v.toLocaleString('fr-FR')+' FCFA';
    b.addEventListener('mouseenter',()=>b.style.opacity='.8');
    b.addEventListener('mouseleave',()=>b.style.opacity='1');
    const l = document.createElement('div');
    l.className = 'bar-lbl';
    l.textContent = (i%7===0) ? days[i].getDate() : '';
    w.appendChild(b);w.appendChild(l);
    chart.appendChild(w);
  });
}

boot();

function showToast(msg,icon=FCI['check-circle']){
  const t=document.getElementById('toast');
  document.getElementById('toast-msg').textContent=msg;
  document.getElementById('toast-icon').innerHTML=icon;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),Math.max(3000,String(msg).length*70));
}

function toggleMobileSidebar(){
  document.querySelector('.sidebar').classList.toggle('open');
  document.querySelector('.sidebar-overlay').classList.toggle('show');
}

function closeSidebarIfMobile(){
  if (window.innerWidth <= 900){
    document.querySelector('.sidebar').classList.remove('open');
    document.querySelector('.sidebar-overlay').classList.remove('show');
  }
}
