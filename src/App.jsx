import { useState, useRef, useEffect } from "react";

//
async function callClaude(system, userMessage, history = []) {
  const messages = [...history, { role: "user", content: userMessage }];
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1000, system, messages }),
  });
  const data = await res.json();
  return data.content?.map(b => b.text || "").join("") || "Ingen respons.";
}

//
const CONTEXT = `Du jobber som AI-assistent for Saxvik Kontorsenter AS i Steinkjer, Trøndelag.
Saxvik selger: interaktive skjermer (møterom, klasserom, auditorium), kasse- og betalingsløsninger, 
postbehandling/makulering, arkivløsninger, LED-skjermer, kontorteknologi. Hovedleverandør: Canon.
Marked: bedrifter nord i Trøndelag. Omsetning ~45 mill, 12 ansatte. Team Tek er tech-avdelingen.
Skriv alltid på norsk. Vær konkret, ikke generell.`;

const SYSTEMS = {
  summary: `${CONTEXT}
Du er referatskriver. Gjør rånotater om til et profesjonelt referat.
Struktur: **Møte/dato** | **Tilstede** | **Nøkkelpunkter** (bullet) | **Beslutninger** | **Handlingspunkter** (ansvarlig + frist) | **Neste steg**
Fyll ikke inn info som ikke er i notatene. Skriv [ikke oppgitt] der noe mangler.`,

  followup: `${CONTEXT}
Du skriver oppfølgingsmailer basert på møtereferater. 
Tonen skal være varm, profesjonell og personlig - ikke generisk selgermail.
Struktur: Takk for møtet -> oppsummer det viktigste kunden sa -> konkret neste steg -> enkel call to action.
Ikke overselg. Ikke bruk buzzwords. Maks 150 ord i selve mailen.
Returner: EMNE: [emne]\n\n[mailinnhold]`,

  call: `${CONTEXT}
Du er en erfaren salgscoach som lager tilpassede samtaleguider for selgere.
Brukeren gir deg info om kunden/prospektet. Du lager:
1. **�&pning** (15 sek, naturlig - ikke robotaktig)
2. **3-4 åpne spørsmål** tilpasset kundens situasjon
3. **Verdiforslag** for Saxvik rettet mot akkurat denne kunden
4. **Håndtering av vanlige innvendinger** (for dyrt / har løsning / ikke tid)
5. **Avslutning** - hvordan booke møte eller neste steg
Tilpass ALT til bransje og situasjon. Ingen generiske fraser.`,

  meetingprep: `${CONTEXT}
Du forbereder selgere til kundemøter. Brukeren gir deg bedriftsnavn og eventuell info.
Lag et møtebrief med:
1. **Hva vi vet om bedriften** (bransje, størrelse, trolig behov)
2. **Mulige smertepunkter** Saxvik kan løse
3. **Anbefalte produkter/løsninger å presentere**
4. **5 gode spørsmål å stille i møtet**
5. **Hva du bør unngå å si**
6. **Målet for møtet** - hva er en god utgang?
Vær konkret og praktisk.`,

  linkedin: `${CONTEXT}
Du er LinkedIn SEO-ekspert for B2B-selgere i Norge.
Når du lager innlegg: skriv for verdi ikke reklame, bruk linjeskift, avslutt med spørsmål, ingen lenker i innlegget.
Returner alltid: [Innlegg] | [Hashtags 5-8 stk] | [Tips]`,
};

//
function loadCustomers() {
  try { return JSON.parse(localStorage.getItem("saxvik_customers") || "[]"); } catch { return []; }
}
function saveCustomers(list) {
  localStorage.setItem("saxvik_customers", JSON.stringify(list));
}

//
const icons = {
  customers: "K", call: "T", meeting: "M", linkedin: "L", notes: "N",
  add: "+", back: "<-", mail: "@", save: "S", copy: "K", check: "OK", trash: "X",
};

//
const C = {
  bg: "#080e1a",
  surface: "#0e1929",
  surfaceHover: "#131f30",
  border: "rgba(255,255,255,0.07)",
  accent: "#0ea5e9",
  accentDim: "rgba(14,165,233,0.15)",
  accentBorder: "rgba(14,165,233,0.3)",
  text: "#dce8f0",
  muted: "#4a6a82",
  success: "#22c55e",
  successDim: "rgba(34,197,94,0.15)",
};

//
function Btn({ children, onClick, disabled, variant = "primary", small }) {
  const base = {
    border: "none", borderRadius: 10, cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit", fontWeight: 600, transition: "all 0.18s",
    padding: small ? "7px 14px" : "11px 22px",
    fontSize: small ? 13 : 14,
  };
  const styles = {
    primary: { background: disabled ? C.accentDim : `linear-gradient(135deg,#0ea5e9,#0077b5)`, color: disabled ? C.muted : "#fff", boxShadow: disabled ? "none" : "0 4px 16px rgba(14,165,233,0.3)" },
    ghost: { background: "rgba(255,255,255,0.05)", color: C.text, border: `1px solid ${C.border}` },
    danger: { background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...styles[variant] }}>{children}</button>;
}

function Card({ children, style }) {
  return <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 24px", ...style }}>{children}</div>;
}

function Tag({ label, color = C.accent }) {
  return <span style={{ padding: "3px 10px", borderRadius: 20, background: `${color}22`, color, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</span>;
}

function Textarea({ value, onChange, placeholder, rows = 4 }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", color: C.text, fontSize: 14, lineHeight: 1.7, resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
  );
}

function ResultBox({ content, onCopy, copied }) {
  if (!content) return null;
  return (
    <div style={{ background: "rgba(14,165,233,0.06)", border: `1px solid ${C.accentBorder}`, borderRadius: 14, padding: "20px 22px", position: "relative" }}>
      <div style={{ fontSize: 14, lineHeight: 1.8, color: C.text, whiteSpace: "pre-wrap" }}>{content}</div>
      <button onClick={onCopy} style={{ position: "absolute", top: 14, right: 14, background: copied ? C.successDim : "rgba(255,255,255,0.07)", border: `1px solid ${copied ? "rgba(34,197,94,0.3)" : C.border}`, borderRadius: 8, color: copied ? C.success : C.muted, fontSize: 12, padding: "5px 12px", cursor: "pointer", transition: "all 0.2s" }}>
        {copied ? `${icons.check} Kopiert` : `${icons.copy} Kopier`}
      </button>
    </div>
  );
}

//

// Customer List
function CustomerList({ customers, onSelect, onNew }) {
  const [search, setSearch] = useState("");
  const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || (c.contact || "").toLowerCase().includes(search.toLowerCase()));
  const statusColor = { prospect: "#f59e0b", aktiv: C.success, inaktiv: C.muted };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#f0f6ff", letterSpacing: "-0.5px" }}>Kundelogg</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>{customers.length} kunder registrert</div>
        </div>
        <Btn onClick={onNew}>{icons.add} Ny kunde</Btn>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Søk kunde eller kontaktperson..."
        style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "11px 16px", color: C.text, fontSize: 14, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" }} />

      {filtered.length === 0 && (
        <Card style={{ textAlign: "center", color: C.muted, padding: "40px 24px" }}>
          {search ? "Ingen treff" : "Ingen kunder ennå - legg til din første!"}
        </Card>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(c => (
          <div key={c.id} onClick={() => onSelect(c)} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 20px", cursor: "pointer", transition: "all 0.18s", display: "flex", justifyContent: "space-between", alignItems: "center" }}
            onMouseEnter={e => e.currentTarget.style.background = C.surfaceHover}
            onMouseLeave={e => e.currentTarget.style.background = C.surface}>
            <div>
              <div style={{ fontWeight: 700, color: "#e8f2ff", fontSize: 15 }}>{c.name}</div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>{c.contact} {c.industry ? `· ${c.industry}` : ""}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              <Tag label={c.status || "prospect"} color={statusColor[c.status] || C.accent} />
              {c.logs?.length > 0 && <div style={{ fontSize: 11, color: C.muted }}>{c.logs.length} {c.logs.length === 1 ? "notat" : "notater"}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// New Customer Form
function NewCustomer({ onSave, onBack }) {
  const [form, setForm] = useState({ name: "", contact: "", phone: "", email: "", industry: "", status: "prospect", notes: "" });
  const set = k => v => setForm(f => ({ ...f, [k]: v }));

  function handleSave() {
    if (!form.name.trim()) return;
    onSave({ ...form, id: Date.now(), logs: [], createdAt: new Date().toISOString() });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer" }}>{icons.back}</button>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#f0f6ff" }}>Ny kunde</div>
      </div>

      <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {[["Bedriftsnavn *", "name", "Rema 1000 Steinkjer"], ["Kontaktperson", "contact", "Ola Nordmann"], ["Telefon", "phone", "+47 900 00 000"], ["E-post", "email", "ola@bedrift.no"], ["Bransje", "industry", "Dagligvare, restaurant, skole..."]].map(([label, key, ph]) => (
          <div key={key}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
            <input value={form[key]} onChange={e => set(key)(e.target.value)} placeholder={ph}
              style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", color: C.text, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
        ))}

        <div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Status</div>
          <div style={{ display: "flex", gap: 8 }}>
            {["prospect", "aktiv", "inaktiv"].map(s => (
              <button key={s} onClick={() => set("status")(s)}
                style={{ padding: "7px 16px", borderRadius: 8, border: `1px solid ${form.status === s ? C.accentBorder : C.border}`, background: form.status === s ? C.accentDim : "transparent", color: form.status === s ? C.accent : C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Notater</div>
          <Textarea value={form.notes} onChange={set("notes")} placeholder="Første inntrykk, potensial, hvordan ble de funnet..." rows={3} />
        </div>
      </Card>

      <Btn onClick={handleSave} disabled={!form.name.trim()}>{icons.save} Lagre kunde</Btn>
    </div>
  );
}

// Customer Detail
function CustomerDetail({ customer, onBack, onUpdate }) {
  const [tab, setTab] = useState("logg");
  const [noteInput, setNoteInput] = useState("");
  const [summary, setSummary] = useState("");
  const [followup, setFollowup] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState("");

  function copy(text, key) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  }

  async function handleGenerateSummary() {
    if (!noteInput.trim()) return;
    setLoading("summary");
    const res = await callClaude(SYSTEMS.summary, `Kunde: ${customer.name}\nKontakt: ${customer.contact}\n\nNotater:\n${noteInput}`);
    setSummary(res);
    setLoading("");
  }

  async function handleGenerateFollowup() {
    const base = summary || noteInput;
    if (!base.trim()) return;
    setLoading("followup");
    const res = await callClaude(SYSTEMS.followup, `Kunde: ${customer.name}\nKontakt: ${customer.contact || "ukjent"}\nBransje: ${customer.industry || "ukjent"}\n\nReferat/notater:\n${base}`);
    setFollowup(res);
    setLoading("");
  }

  function saveLog() {
    if (!summary.trim() && !noteInput.trim()) return;
    const log = {
      id: Date.now(),
      date: new Date().toLocaleDateString("nb-NO"),
      raw: noteInput,
      summary: summary || noteInput,
      followup,
    };
    const updated = { ...customer, logs: [log, ...(customer.logs || [])] };
    onUpdate(updated);
    setNoteInput("");
    setSummary("");
    setFollowup("");
    setTab("logg");
  }

  const detailTabs = ["logg", "nytt møte"];
  const statusColor = { prospect: "#f59e0b", aktiv: C.success, inaktiv: C.muted };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer", marginTop: 4 }}>{icons.back}</button>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#f0f6ff" }}>{customer.name}</div>
            <Tag label={customer.status || "prospect"} color={statusColor[customer.status] || C.accent} />
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            {[customer.contact, customer.phone, customer.email, customer.industry].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
        {detailTabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: "9px 18px", border: "none", background: "transparent", color: tab === t ? C.accent : C.muted, fontWeight: tab === t ? 700 : 400, fontSize: 14, cursor: "pointer", borderBottom: tab === t ? `2px solid ${C.accent}` : "2px solid transparent", fontFamily: "inherit", textTransform: "capitalize" }}>
            {t === "logg" ? "Logg" : "Nytt møte"}
          </button>
        ))}
      </div>

      {/* Log tab */}
      {tab === "logg" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {customer.notes && (
            <Card style={{ background: "rgba(14,165,233,0.05)", borderColor: C.accentBorder }}>
              <div style={{ fontSize: 12, color: C.accent, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Generelle notater</div>
              <div style={{ fontSize: 14, color: C.text, lineHeight: 1.7 }}>{customer.notes}</div>
            </Card>
          )}
          {(customer.logs || []).length === 0 && !customer.notes && (
            <Card style={{ textAlign: "center", color: C.muted, padding: "40px 24px" }}>Ingen møter logget ennå</Card>
          )}
          {(customer.logs || []).map(log => (
            <Card key={log.id}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: C.muted }}>{log.date}</div>
              </div>
              <div style={{ fontSize: 14, color: C.text, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{log.summary}</div>
              {log.followup && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>{icons.mail} Oppfølgingsmail</div>
                  <div style={{ fontSize: 13, color: "#9ab8cc", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{log.followup}</div>
                  <button onClick={() => copy(log.followup, log.id)} style={{ marginTop: 10, background: "none", border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, fontSize: 12, padding: "5px 12px", cursor: "pointer" }}>
                    {copied === log.id ? `${icons.check} Kopiert` : `${icons.copy} Kopier mail`}
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* New meeting tab */}
      {tab === "nytt møte" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>Rånotater fra møtet</div>
            <Textarea value={noteInput} onChange={setNoteInput} placeholder={`Hva ble diskutert med ${customer.name}?\n- Problem de nevnte\n- Produkter som er aktuelle\n- Hvem bestemmer\n- Neste steg`} rows={6} />
          </Card>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn onClick={handleGenerateSummary} disabled={!noteInput.trim() || loading === "summary"}>
              {loading === "summary" ? "Genererer..." : "Generer referat"}
            </Btn>
            <Btn onClick={handleGenerateFollowup} disabled={(!noteInput.trim() && !summary.trim()) || loading === "followup"} variant="ghost">
              {loading === "followup" ? "ó�& Skriver mail..." : `${icons.mail} Generer oppfølgingsmail`}
            </Btn>
          </div>

          {summary && (
            <div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>Referat</div>
              <ResultBox content={summary} onCopy={() => copy(summary, "sum")} copied={copied === "sum"} />
            </div>
          )}

          {followup && (
            <div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>Oppfølgingsmail</div>
              <ResultBox content={followup} onCopy={() => copy(followup, "fu")} copied={copied === "fu"} />
            </div>
          )}

          {(summary || noteInput) && (
            <Btn onClick={saveLog}>{icons.save} Lagre i kundelogg</Btn>
          )}
        </div>
      )}
    </div>
  );
}

// Call Assistant
function CallAssistant() {
  const [form, setForm] = useState({ company: "", industry: "", size: "", context: "", product: "" });
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const set = k => v => setForm(f => ({ ...f, [k]: v }));

  async function generate() {
    if (!form.company.trim()) return;
    setLoading(true);
    const prompt = `Bedrift: ${form.company}\nBransje: ${form.industry || "ukjent"}\nStørrelse: ${form.size || "ukjent"}\nKontekst: ${form.context || "kald kontakt"}\nAktuelt produkt/løsning: ${form.product || "generell kartlegging"}`;
    const res = await callClaude(SYSTEMS.call, prompt);
    setResult(res);
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#f0f6ff", letterSpacing: "-0.5px" }}>Samtaleguide</div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>For cold calls, oppfølging og kundedialog</div>
      </div>

      <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {[
          ["Bedrift / person *", "company", "Rema 1000 Steinkjer"],
          ["Bransje", "industry", "Dagligvare, skole, restaurant, industri..."],
          ["Størrelse", "size", "Liten, 10-50 ansatte, stor kjede..."],
          ["Kontekst", "context", "Kald kontakt / oppfølging etter mail / referral fra X"],
          ["Aktuelt produkt", "product", "Kasseløsning, interaktiv skjerm, møteromsutstyr..."],
        ].map(([label, key, ph]) => (
          <div key={key}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
            <input value={form[key]} onChange={e => set(key)(e.target.value)} placeholder={ph}
              style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", color: C.text, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
        ))}
        <Btn onClick={generate} disabled={!form.company.trim() || loading}>
          {loading ? "Lager guide..." : "Generer samtaleguide"}
        </Btn>
      </Card>

      {result && <ResultBox content={result} onCopy={() => { navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000); }} copied={copied} />}
    </div>
  );
}

// Meeting Prep
function MeetingPrep() {
  const [form, setForm] = useState({ company: "", contact: "", industry: "", known: "", goal: "" });
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const set = k => v => setForm(f => ({ ...f, [k]: v }));

  async function generate() {
    if (!form.company.trim()) return;
    setLoading(true);
    const prompt = `Bedrift: ${form.company}\nKontaktperson: ${form.contact || "ukjent"}\nBransje: ${form.industry || "ukjent"}\nHva vi vet: ${form.known || "ingenting ennå"}\nMål med møtet: ${form.goal || "kartlegge behov"}`;
    const res = await callClaude(SYSTEMS.meetingprep, prompt);
    setResult(res);
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#f0f6ff", letterSpacing: "-0.5px" }}>Møteforberedelse</div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>Kom forberedt til hvert møte</div>
      </div>

      <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {[
          ["Bedrift *", "company", "Steinkjer VGS"],
          ["Kontaktperson", "contact", "Rektor / IT-ansvarlig"],
          ["Bransje", "industry", "Utdanning, helse, handel..."],
          ["Hva vi allerede vet", "known", "Ringte i forrige uke, interessert i skjermer..."],
          ["Mål med møtet", "goal", "Demo, behovskartlegging, tilbud..."],
        ].map(([label, key, ph]) => (
          <div key={key}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
            <input value={form[key]} onChange={e => set(key)(e.target.value)} placeholder={ph}
              style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", color: C.text, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
        ))}
        <Btn onClick={generate} disabled={!form.company.trim() || loading}>
          {loading ? "Forbereder..." : "Generer møtebrief"}
        </Btn>
      </Card>

      {result && <ResultBox content={result} onCopy={() => { navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000); }} copied={copied} />}
    </div>
  );
}

// LinkedIn
function LinkedIn() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [history]);

  async function send() {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput("");
    setLoading(true);
    const newH = [...history, { role: "user", content: msg }];
    setHistory(newH);
    const apiH = history.map(m => ({ role: m.role, content: m.content }));
    const res = await callClaude(SYSTEMS.linkedin, msg, apiH);
    setHistory([...newH, { role: "assistant", content: res }]);
    setLoading(false);
  }

  const suggestions = ["Skriv innlegg om interaktive skjermer i møterom", "Lag en LinkedIn-overskrift for meg", "Innlegg om kasseløsning for restaurant", "Tips for å bygge nettverk i Trøndelag"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#f0f6ff", letterSpacing: "-0.5px" }}>LinkedIn SEO</div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>Innlegg, profiltekst og hashtags</div>
      </div>

      {history.length === 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => setInput(s)}
              style={{ padding: "8px 14px", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 20, color: "#7aaabb", fontSize: 13, cursor: "pointer" }}
              onMouseEnter={e => e.target.style.background = C.accentDim}
              onMouseLeave={e => e.target.style.background = "rgba(255,255,255,0.04)"}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, minHeight: 200 }}>
        {history.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "82%", padding: "12px 16px", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: m.role === "user" ? "linear-gradient(135deg,#0ea5e9,#0077b5)" : C.surface, border: m.role === "assistant" ? `1px solid ${C.border}` : "none", fontSize: 14, lineHeight: 1.7, color: m.role === "user" ? "#fff" : C.text, whiteSpace: "pre-wrap" }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && <div style={{ display: "flex", gap: 5, padding: 8 }}>{[0,1,2].map(d => <div key={d} style={{ width: 7, height: 7, borderRadius: "50%", background: C.accent, animation: "pulse 1.2s ease-in-out infinite", animationDelay: `${d*0.2}s` }} />)}</div>}
        <div ref={endRef} />
      </div>

      <div style={{ display: "flex", gap: 8, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "4px 4px 4px 14px" }}>
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }}} placeholder="Beskriv hva du vil lage..." rows={2}
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 14, resize: "none", lineHeight: 1.6, paddingTop: 10, fontFamily: "inherit" }} />
        <button onClick={send} disabled={loading || !input.trim()}
          style={{ padding: "10px 16px", background: loading || !input.trim() ? C.accentDim : "linear-gradient(135deg,#0ea5e9,#0077b5)", border: "none", borderRadius: 10, color: "#fff", fontSize: 18, cursor: "pointer", alignSelf: "flex-end", marginBottom: 4 }}>{">"}</button>
      </div>
    </div>
  );
}

//
const NAV = [
  { id: "customers", label: "Kunder", icon: icons.customers },
  { id: "call", label: "Samtaleguide", icon: icons.call },
  { id: "meeting", label: "Møteprep", icon: icons.meeting },
  { id: "linkedin", label: "LinkedIn", icon: icons.linkedin },
];

export default function App() {
  const [view, setView] = useState("customers");
  const [customers, setCustomers] = useState(loadCustomers);
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);

  function addCustomer(c) {
    const updated = [c, ...customers];
    setCustomers(updated);
    saveCustomers(updated);
    setAdding(false);
    setSelected(c);
  }

  function updateCustomer(c) {
    const updated = customers.map(x => x.id === c.id ? c : x);
    setCustomers(updated);
    saveCustomers(updated);
    setSelected(c);
  }

  function renderMain() {
    if (view === "customers") {
      if (adding) return <NewCustomer onSave={addCustomer} onBack={() => setAdding(false)} />;
      if (selected) return <CustomerDetail customer={selected} onBack={() => setSelected(null)} onUpdate={updateCustomer} />;
      return <CustomerList customers={customers} onSelect={setSelected} onNew={() => setAdding(true)} />;
    }
    if (view === "call") return <CallAssistant />;
    if (view === "meeting") return <MeetingPrep />;
    if (view === "linkedin") return <LinkedIn />;
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'DM Sans','Segoe UI',sans-serif", color: C.text, display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{ padding: "18px 24px 0", borderBottom: `1px solid ${C.border}`, background: C.bg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#0ea5e9,#0077b5)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, color: "#fff", boxShadow: "0 4px 14px rgba(14,165,233,0.35)" }}>S</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#e8f4ff", letterSpacing: "-0.3px" }}>Saxvik Salgsassistent</div>
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => { setView(n.id); setSelected(null); setAdding(false); }}
              style={{ padding: "9px 16px", border: "none", background: "transparent", color: view === n.id ? C.accent : C.muted, fontWeight: view === n.id ? 700 : 400, fontSize: 13, cursor: "pointer", borderBottom: view === n.id ? `2px solid ${C.accent}` : "2px solid transparent", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
              <span>{n.icon}</span> {n.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: "28px 24px", maxWidth: 860, width: "100%", margin: "0 auto", boxSizing: "border-box", overflowY: "auto" }}>
        {renderMain()}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:.3;transform:scale(.8)} 50%{opacity:1;transform:scale(1)} }
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px}
        input::placeholder,textarea::placeholder{color:#2a4a5e}
      `}</style>
    </div>
  );
}


