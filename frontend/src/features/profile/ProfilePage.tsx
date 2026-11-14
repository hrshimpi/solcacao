import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router";
import type { AppContext } from "../../types";

const copy = {
  EN: {
    eyebrow: "Field account · Member since 2021",
    title: "Your profile",
    edit: "Edit profile",
    cancel: "Cancel",
    save: "Save changes",
    personal: "Personal details",
    name: "Full name",
    email: "Email address",
    location: "Location",
    phone: "Phone",
    bio: "A note about you",
    bioText:
      "Pastry chef, careful taster, and lifelong student of cacao. I collect origin stories and believe the best chocolate begins with knowing who grew it.",
    settings: "Account settings",
    settingsNote: "Manage your security and communication preferences.",
    password: "Change password",
    passwordHint: "Last changed 8 months ago",
    notifications: "Notification preferences",
    notificationsHint: "Harvest notes, releases, and order updates",
    logout: "Log out",
    logoutHint: "End this session securely",
    passwordPanel: "Password reset",
    passwordBody: "We’ll send a secure reset link to your email address.",
    send: "Send reset link",
    resetSent: "Reset link sent",
    photoAlt: "Portrait of Isabel Vásquez",
    photoAction: "Change photo",
    note: "Profile no. 0417",
  },
  ES: {
    eyebrow: "Cuenta de campo · Miembro desde 2021",
    title: "Tu perfil",
    edit: "Editar perfil",
    cancel: "Cancelar",
    save: "Guardar cambios",
    personal: "Datos personales",
    name: "Nombre completo",
    email: "Correo electrónico",
    location: "Ubicación",
    phone: "Teléfono",
    bio: "Una nota sobre ti",
    bioText:
      "Pastelera, catadora cuidadosa y estudiante de cacao de por vida. Colecciono historias de origen y creo que el mejor chocolate comienza por conocer a quien lo cultivó.",
    settings: "Configuración de la cuenta",
    settingsNote: "Administra tu seguridad y preferencias de comunicación.",
    password: "Cambiar contraseña",
    passwordHint: "Último cambio hace 8 meses",
    notifications: "Preferencias de notificación",
    notificationsHint: "Notas de cosecha, lanzamientos y pedidos",
    logout: "Cerrar sesión",
    logoutHint: "Finaliza esta sesión de forma segura",
    passwordPanel: "Restablecer contraseña",
    passwordBody: "Enviaremos un enlace seguro a tu correo electrónico.",
    send: "Enviar enlace",
    resetSent: "Enlace enviado",
    photoAlt: "Retrato de Isabel Vásquez",
    photoAction: "Cambiar foto",
    note: "Perfil n.º 0417",
  },
};

function ArrowIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

export default function ProfilePage() {
  const { lang } = useOutletContext<AppContext>();
  const navigate = useNavigate();
  const t = copy[lang];
  const [editing, setEditing] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [profile, setProfile] = useState({
    name: "Isabel Vásquez",
    email: "isabel.vasquez@example.com",
    location: "Austin, Texas",
    phone: "+1 512 555 0184",
    bio: t.bioText,
  });

  const fieldClass = editing
    ? "w-full bg-transparent border-b border-pod-wine py-1 font-sans text-sm text-ink-cacao focus:outline-none"
    : "w-full bg-transparent border-b border-transparent py-1 font-sans text-sm text-ink-cacao focus:outline-none";

  const update = (key: keyof typeof profile, value: string) =>
    setProfile((current) => ({ ...current, [key]: value }));

  return (
    <main className="pt-14 min-h-screen bg-stone-paper">
      <header className="border-b border-ink-cacao">
        <div className="max-w-6xl mx-auto px-6 py-10 md:py-14 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
          <div>
            <p className="font-sans text-[10px] tracking-[0.18em] uppercase text-pod-wine mb-3">
              {t.eyebrow}
            </p>
            <h1 className="font-spectral text-4xl md:text-5xl font-semibold tracking-tight text-ink-cacao">
              {t.title}
            </h1>
          </div>
          <button
            onClick={() => setEditing((value) => !value)}
            className={`self-start sm:self-auto font-sans text-sm font-medium px-6 py-3 border transition-colors ${
              editing
                ? "border-ink-cacao text-ink-cacao hover:bg-clay-surface"
                : "border-sun-gold bg-sun-gold text-ink-cacao hover:bg-sun-gold/85"
            }`}
          >
            {editing ? t.cancel : t.edit}
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10 md:py-16 grid lg:grid-cols-[1fr_2fr] gap-12 lg:gap-20">
        <aside>
          <div className="relative aspect-[4/5] max-w-sm overflow-hidden bg-clay-surface">
            <img
              src="https://images.unsplash.com/photo-1743807059766-9d3ca4f35b60?crop=faces&cs=tinysrgb&fit=crop&fm=jpg&h=900&q=85&w=720"
              alt={t.photoAlt}
              className="w-full h-full object-cover grayscale-[15%]"
            />
            <div className="absolute left-0 bottom-0 bg-ink-cacao text-paper-text px-4 py-2 font-mono text-[9px] tracking-wider uppercase">
              {t.note}
            </div>
          </div>
          {editing && (
            <button className="mt-3 font-sans text-xs text-pod-wine underline underline-offset-4 hover:text-ink-cacao transition-colors">
              {t.photoAction}
            </button>
          )}
          <div className="mt-7 border-t border-ink-cacao/20 pt-5">
            <p className="font-spectral text-2xl font-semibold text-ink-cacao">{profile.name}</p>
            <p className="font-sans text-sm text-ink-cacao/55 mt-1">{profile.email}</p>
          </div>
        </aside>

        <div>
          <section>
            <div className="flex items-center justify-between border-b border-ink-cacao pb-4">
              <h2 className="font-spectral text-2xl font-semibold text-ink-cacao">{t.personal}</h2>
              <span className="font-mono text-[9px] uppercase tracking-widest text-ink-cacao/40">
                SC-ACCT-0417
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-x-10">
              {(
                [
                  ["name", t.name],
                  ["email", t.email],
                  ["location", t.location],
                  ["phone", t.phone],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="border-b border-ink-cacao/15 py-5 block">
                  <span className="font-sans text-[9px] tracking-widest text-ink-cacao/45 uppercase block mb-1">
                    {label}
                  </span>
                  <input
                    readOnly={!editing}
                    value={profile[key]}
                    onChange={(event) => update(key, event.target.value)}
                    className={fieldClass}
                  />
                </label>
              ))}
            </div>

            <label className="block border-b border-ink-cacao/15 py-5">
              <span className="font-sans text-[9px] tracking-widest text-ink-cacao/45 uppercase block mb-2">
                {t.bio}
              </span>
              <textarea
                readOnly={!editing}
                rows={3}
                value={profile.bio}
                onChange={(event) => update("bio", event.target.value)}
                className={`${fieldClass} resize-none font-spectral text-base leading-relaxed`}
              />
            </label>

            {editing && (
              <div className="flex justify-end pt-6">
                <button
                  onClick={() => setEditing(false)}
                  className="font-sans text-sm font-medium bg-sun-gold text-ink-cacao px-7 py-3 hover:bg-sun-gold/85 transition-colors"
                >
                  {t.save}
                </button>
              </div>
            )}
          </section>

          <section className="mt-14 md:mt-16">
            <div className="border-b border-ink-cacao pb-4">
              <h2 className="font-spectral text-2xl font-semibold text-ink-cacao">{t.settings}</h2>
              <p className="font-sans text-xs text-ink-cacao/50 mt-1">{t.settingsNote}</p>
            </div>

            <button
              onClick={() => setPasswordOpen((value) => !value)}
              className="w-full flex items-center justify-between text-left py-5 border-b border-ink-cacao/15 group"
            >
              <span>
                <span className="font-sans text-sm font-medium text-ink-cacao block">
                  {t.password}
                </span>
                <span className="font-sans text-xs text-ink-cacao/45 block mt-1">
                  {t.passwordHint}
                </span>
              </span>
              <span className="text-ink-cacao/45 group-hover:text-pod-wine group-hover:translate-x-1 transition-all">
                <ArrowIcon />
              </span>
            </button>

            {passwordOpen && (
              <div className="bg-clay-surface px-5 py-5 border-b border-ink-cacao/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="font-spectral font-semibold text-ink-cacao">{t.passwordPanel}</p>
                  <p className="font-sans text-xs text-ink-cacao/55 mt-1">{t.passwordBody}</p>
                </div>
                <button
                  onClick={() => setResetSent(true)}
                  className="shrink-0 border border-ink-cacao px-4 py-2 font-sans text-xs font-medium hover:bg-ink-cacao hover:text-paper-text transition-colors"
                >
                  {resetSent ? t.resetSent : t.send}
                </button>
              </div>
            )}

            <div className="flex items-center justify-between py-5 border-b border-ink-cacao/15">
              <div className="pr-4">
                <p className="font-sans text-sm font-medium text-ink-cacao">{t.notifications}</p>
                <p className="font-sans text-xs text-ink-cacao/45 mt-1">{t.notificationsHint}</p>
              </div>
              <button
                onClick={() => setNotifications((value) => !value)}
                role="switch"
                aria-checked={notifications}
                className={`relative w-11 h-6 shrink-0 border transition-colors ${
                  notifications
                    ? "bg-canopy-green border-canopy-green"
                    : "bg-transparent border-ink-cacao/30"
                }`}
              >
                <span
                  className={`absolute top-1 w-3.5 h-3.5 bg-stone-paper transition-all ${
                    notifications ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>

            <button
              onClick={() => navigate("/login")}
              className="w-full flex items-center justify-between text-left py-5 border-b border-ink-cacao/15 group"
            >
              <span>
                <span className="font-sans text-sm font-medium text-pod-wine block">
                  {t.logout}
                </span>
                <span className="font-sans text-xs text-ink-cacao/45 block mt-1">
                  {t.logoutHint}
                </span>
              </span>
              <span className="text-pod-wine group-hover:translate-x-1 transition-transform">
                <ArrowIcon />
              </span>
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}
