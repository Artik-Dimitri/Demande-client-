/* Collecteur de factures Organilog → Espace équipe (lancé par le favori « 📊 Envoyer les factures »).
   Lecture seule : il lit les listes Factures et Avoirs d'Organilog avec ta session, et les envoie à la page « CA par catégorie ». */
(async function () {
  const DEST = "https://artik-dimitri.github.io", PAGE = DEST + "/Demande-client-/factures.html#import";
  if (!/\.organilog\.com$/.test(location.hostname)) { alert("Ouvre d'abord Organilog (factures), puis clique sur le favori."); return; }
  if (window.__artikCol) { window.__artikCol.box.hidden = false; return; }
  const soc = /chassaing/i.test(location.hostname) ? "chassaing" : "artik";
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;width:min(380px,calc(100vw - 32px));background:#fff;color:#242223;border:2px solid #E4670A;border-radius:12px;padding:14px 16px;font:14px/1.45 system-ui,sans-serif;box-shadow:0 12px 34px rgba(0,0,0,.25)";
  box.innerHTML = '<div style="display:flex;justify-content:space-between;gap:8px"><b>📊 Envoi des factures · ' + (soc === "artik" ? "Artik" : "Chassaing") + '</b><button type="button" data-x style="border:0;background:none;font-size:18px;cursor:pointer">✕</button></div><div data-s style="margin-top:6px">Préparation…</div><div data-a style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"></div>';
  document.body.appendChild(box);
  const S = t => box.querySelector("[data-s]").innerHTML = t, A = box.querySelector("[data-a]");
  box.querySelector("[data-x]").onclick = () => box.hidden = true;
  window.__artikCol = { box };
  const btn = (t, fn, pri) => { const b = document.createElement("button"); b.type = "button"; b.textContent = t; b.style.cssText = "font:inherit;font-weight:600;border-radius:8px;padding:6px 12px;cursor:pointer;border:1px solid " + (pri ? "#E4670A;background:#E4670A;color:#fff" : "#ccc;background:#fff;color:#242223"); b.onclick = fn; A.appendChild(b); return b };
  const J = async u => { const r = await fetch(u, { credentials: "include" }); const t = await r.text(); try { return JSON.parse(t) } catch (e) { throw new Error(/connexion|login/i.test(t) ? "session Organilog expirée, reconnecte-toi" : "réponse inattendue d'Organilog") } };
  let w = window.__artikW && !window.__artikW.closed ? window.__artikW : null, done = false, pack = null;
  const send = () => { if (w && pack && !done) w.postMessage(pack, DEST) };
  window.addEventListener("message", e => {
    if (e.origin !== DEST || !e.data) return;
    if (e.data.type === "artik-ready") { w = e.source; send() }
    if (e.data.type === "artik-saved") { done = true; A.innerHTML = ""; S("✅ C'est envoyé : " + e.data.n + " lignes enregistrées dans « CA par catégorie ». Tu peux fermer."); }
    if (e.data.type === "artik-error") { S("⚠️ La page a refusé l'envoi : " + String(e.data.msg || "").replace(/</g, "&lt;")); }
  });
  try {
    const cut = "2000-01-01"; /* tout l'historique */
    /* champ « Catégorie client » (typologie) */
    let un = [];
    try { const u = await J("/script/ajax/get_unites.php?type=invoice"); const l = Array.isArray(u) ? u : (u.data || u.unites || Object.values(u).find(Array.isArray) || []); un = l.filter(x => /cat[ée]gorie client|typolog/i.test(String(x.nom || x.label || ""))).map(x => x.id || x.key); } catch (e) { }
    if (!un.length && soc === "artik") un = [118358];
    const q = "is_listing=true&get_client=true&get_category=true&get_unites=true&get_invoice_links=true&active=true" + un.map((id, i) => "&un_ids%5B" + i + "%5D=" + id).join("");
    const typo = i => { const u = (i.unites || []).find(x => un.includes(Number(x.key)) || /cat[ée]gorie client|typolog/i.test(x.label || "")); if (!u || u.value == null || u.value === "") return ""; const d = (u.data || []).find(o => String(o.value) === String(u.value)); return String(d ? d.label : u.value).trim() };
    const T = { 1: "F", 2: "A", 6: "S" }, rows = [];
    const links = i => { try { return (i.invoice_all_links || []).filter(x => x.entity === "invoice").map(x => x.id) } catch (e) { return [] } };
    const one = (i, t) => ({ i: i.i_id, n: i.i_num_invoice || "", t, d: i.i_date, ht: Math.round((+i.i_cache_pt_ht || 0) * 100) / 100, c: i.ic_nom || "", cid: i.i_fk_client_id, cl: i.client_card || "", ty: typo(i), b: i.i_is_draft ? 1 : 0, l: 0, ls: t === "V" ? links(i) : undefined, r: String(i.i_reference || "").slice(0, 60) });
    for (const [ep, kind] of [["get_invoices.php", "fac"], ["get_invoice_avoirs.php", "avoir"]]) {
      for (let p = 0; p < 400; p++) {
        S((kind === "fac" ? "Lecture des factures" : "Lecture des avoirs") + "… page " + (p + 1) + " · " + rows.length + " lues");
        const l = await J("/script/ajax/" + ep + "?" + q + "&page=" + p);
        if (!Array.isArray(l) || !l.length) break;
        l.forEach(i => { const t = kind === "avoir" ? "V" : T[i.i_is_invoice]; if (t && i.i_date >= cut) rows.push(one(i, t)) });
        if (l.every(i => String(i.i_date) < cut)) break;
      }
    }
    /* avoir : la facture qu'il annule = facture liée de même montant, sinon la dernière facture liée avant l'avoir */
    const byId = {}; rows.forEach(r => byId[r.i] = r);
    rows.forEach(r => { if (r.t !== "V") return; const L = (r.ls || []).map(id => byId[id]).filter(o => o && (o.t === "F" || o.t === "S")); delete r.ls; if (!L.length) return;
      const o = L.find(o => Math.abs(o.ht - r.ht) < 0.05) || L.filter(o => o.d <= r.d).sort((a, b) => b.d.localeCompare(a.d))[0] || L[0]; r.l = o.i; });
    const first = rows.reduce((m, r) => r.d < m ? r.d : m, "9999");
    pack = { type: "artik-factures", v: 1, soc, host: location.hostname, at: new Date().toISOString(), from: first.slice(0, 7) + "-01", rows };
    S("✅ " + rows.length + " factures et avoirs lus depuis le " + pack.from.split("-").reverse().join("/") + ". Envoi à l'Espace équipe…");
    const open = () => { w = window.open(PAGE, "artikfact"); };
    if (!w) { S(box.querySelector("[data-s]").innerHTML + "<br>Clique pour ouvrir la page et envoyer."); btn("Ouvrir « CA par catégorie »", open, true) } else send();
    btn("Télécharger le fichier", () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(pack)], { type: "application/json" })); a.download = "factures-" + soc + "-" + pack.at.slice(0, 10) + ".json"; document.body.appendChild(a); a.click(); a.remove() });
    setTimeout(() => { if (!done) S(box.querySelector("[data-s]").innerHTML + "<br><small>Pas de réponse de la page ? Ouvre « CA par catégorie », connecte-toi, puis reclique sur le favori. Ou télécharge le fichier et glisse-le dans la page.</small>") }, 45000);
  } catch (e) { S("⚠️ " + (e.message || e)); }
})();
