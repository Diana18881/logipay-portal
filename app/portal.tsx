"use client";

import { useMemo, useState } from "react";

type Role = "management" | "accountant" | "dispatcher" | "driver";
type Section = "overview" | "payroll" | "team" | "trips" | "reports";

const roles: Record<Role, { label: string; name: string; title: string; initials: string }> = {
  management: { label: "Менеджмент", name: "Алексей Орлов", title: "Операционный директор", initials: "АО" },
  accountant: { label: "Бухгалтер", name: "Елена Волкова", title: "Главный бухгалтер", initials: "ЕВ" },
  dispatcher: { label: "Диспетчер", name: "Ирина Соколова", title: "Старший диспетчер", initials: "ИС" },
  driver: { label: "Водитель", name: "Михаил Козлов", title: "Водитель · TRK-184", initials: "МК" },
};

const navigation: { id: Section; label: string; icon: string; roles: Role[] }[] = [
  { id: "overview", label: "Обзор", icon: "⌂", roles: ["management", "accountant", "dispatcher", "driver"] },
  { id: "payroll", label: "Зарплаты", icon: "₽", roles: ["management", "accountant", "driver"] },
  { id: "team", label: "Сотрудники", icon: "◉", roles: ["management", "accountant", "dispatcher"] },
  { id: "trips", label: "Рейсы и смены", icon: "↗", roles: ["management", "dispatcher", "driver"] },
  { id: "reports", label: "Отчёты", icon: "▥", roles: ["management", "accountant"] },
];

const employees = [
  { initials: "МК", name: "Михаил Козлов", role: "Водитель", unit: "TRK-184", hours: "176 ч", amount: "148 400 ₽", status: "К выплате", tone: "mint" },
  { initials: "АС", name: "Андрей Смирнов", role: "Водитель", unit: "TRK-221", hours: "168 ч", amount: "136 800 ₽", status: "К выплате", tone: "blue" },
  { initials: "ИС", name: "Ирина Соколова", role: "Диспетчер", unit: "Смена А", hours: "160 ч", amount: "112 500 ₽", status: "Проверено", tone: "violet" },
  { initials: "ДП", name: "Денис Петров", role: "Водитель", unit: "TRK-097", hours: "152 ч", amount: "121 900 ₽", status: "На проверке", tone: "amber" },
  { initials: "НК", name: "Наталья Ким", role: "Логист", unit: "Офис", hours: "160 ч", amount: "104 000 ₽", status: "Проверено", tone: "rose" },
];

const trips = [
  { route: "Берлин → Варшава", id: "R-2841", driver: "Михаил Козлов", date: "28–30 июля", amount: "18 400 ₽", status: "Завершён" },
  { route: "Гамбург → Прага", id: "R-2838", driver: "Андрей Смирнов", date: "27–29 июля", amount: "16 900 ₽", status: "Завершён" },
  { route: "Лейпциг → Вена", id: "R-2847", driver: "Денис Петров", date: "30 июл–1 авг", amount: "14 600 ₽", status: "В пути" },
  { route: "Дрезден → Мюнхен", id: "R-2850", driver: "Сергей Белов", date: "31 июл", amount: "9 800 ₽", status: "Назначен" },
];

function formatRubles(value: number) {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

export function Portal() {
  const [role, setRole] = useState<Role>("management");
  const [section, setSection] = useState<Section>("overview");
  const [period, setPeriod] = useState("Июль 2026");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);

  const person = roles[role];
  const allowedNavigation = navigation.filter((item) => item.roles.includes(role));
  const filteredEmployees = useMemo(
    () => employees.filter((employee) => `${employee.name} ${employee.role} ${employee.unit}`.toLowerCase().includes(search.toLowerCase())),
    [search],
  );

  function changeRole(nextRole: Role) {
    setRole(nextRole);
    const firstAllowed = navigation.find((item) => item.id === section)?.roles.includes(nextRole);
    if (!firstAllowed) setSection("overview");
    setNotice(`Демо-доступ: ${roles[nextRole].label}`);
    window.setTimeout(() => setNotice(""), 2400);
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><span /><span /><span /></div>
          <div><strong>LOGIPAY</strong><small>logistics salary hub</small></div>
        </div>

        <div className="demo-label">ДЕМО-ДОСТУП</div>
        <label className="role-picker">
          <span className="sr-only">Выберите роль</span>
          <select value={role} onChange={(event) => changeRole(event.target.value as Role)}>
            {Object.entries(roles).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
          </select>
        </label>

        <nav aria-label="Основная навигация">
          <p>РАБОЧЕЕ ПРОСТРАНСТВО</p>
          {allowedNavigation.map((item) => (
            <button
              key={item.id}
              className={section === item.id ? "nav-active" : ""}
              onClick={() => { setSection(item.id); setMobileMenu(false); }}
            >
              <span className="nav-icon">{item.icon}</span>{item.label}
              {item.id === "payroll" && role === "accountant" ? <em>3</em> : null}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button><span className="nav-icon">?</span>Поддержка</button>
          <button><span className="nav-icon">⚙</span>Настройки</button>
          <div className="profile">
            <div className="avatar">{person.initials}</div>
            <div><strong>{person.name}</strong><small>{person.title}</small></div>
            <span>•••</span>
          </div>
        </div>
      </aside>

      {mobileMenu ? <button className="backdrop" aria-label="Закрыть меню" onClick={() => setMobileMenu(false)} /> : null}

      <section className="workspace">
        <header className="topbar">
          <button className="menu-toggle" aria-label="Открыть меню" onClick={() => setMobileMenu(true)}>☰</button>
          <div className="period-control">
            <span>Расчётный период</span>
            <select value={period} onChange={(event) => setPeriod(event.target.value)}>
              <option>Июль 2026</option>
              <option>Июнь 2026</option>
              <option>Май 2026</option>
            </select>
          </div>
          <div className="top-actions">
            <label className="search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск сотрудника…" /></label>
            <button className="icon-button" aria-label="Уведомления">♢<i /></button>
            <div className="status-chip"><span /> Данные синхронизированы</div>
          </div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div>
              <p>{role === "driver" ? "Личный кабинет" : "Финансы и операционная деятельность"}</p>
              <h1>{section === "overview" ? `Добрый день, ${person.name.split(" ")[0]}` : navigation.find((item) => item.id === section)?.label}</h1>
              <span>{role === "driver" ? "Ваши рейсы, начисления и документы" : `Сводка за ${period.toLowerCase()} · обновлено сегодня, 09:42`}</span>
            </div>
            {role !== "driver" && (section === "overview" || section === "payroll") ? (
              <button className="primary-button" onClick={() => setNotice("Расчёт зарплаты подготовлен")}>＋ Рассчитать зарплату</button>
            ) : (
              <button className="primary-button" onClick={() => setNotice("Отчёт готов к выгрузке")}>↓ Скачать отчёт</button>
            )}
          </div>

          {section === "overview" && <Overview role={role} />}
          {section === "payroll" && <Payroll role={role} employees={filteredEmployees} />}
          {section === "team" && <Team employees={filteredEmployees} search={search} setSearch={setSearch} />}
          {section === "trips" && <Trips role={role} />}
          {section === "reports" && <Reports />}
        </div>
      </section>
      {notice ? <div className="toast"><span>✓</span>{notice}</div> : null}
    </main>
  );
}

function Overview({ role }: { role: Role }) {
  if (role === "driver") {
    return (
      <>
        <div className="driver-hero">
          <div><small>К ВЫПЛАТЕ ЗА ИЮЛЬ</small><strong>148 400 ₽</strong><span>Выплата запланирована на 5 августа</span></div>
          <div className="pay-breakdown"><p><span>Оклад</span><b>78 000 ₽</b></p><p><span>Рейсы и километраж</span><b>64 200 ₽</b></p><p><span>Суточные</span><b>9 600 ₽</b></p><p><span>Удержания</span><b>−3 400 ₽</b></p></div>
        </div>
        <div className="metric-grid driver-metrics">
          <Metric icon="↗" label="Рейсов завершено" value="12" delta="+2 к июню" tone="cyan" />
          <Metric icon="◎" label="Километров" value="8 742" delta="97% по GPS" tone="violet" />
          <Metric icon="◷" label="Часов в сменах" value="176" delta="Норма: 168 ч" tone="amber" />
          <Metric icon="☆" label="Рейтинг" value="4,9" delta="Отличный результат" tone="mint" />
        </div>
        <Trips role="driver" compact />
      </>
    );
  }

  return (
    <>
      <div className="metric-grid">
        <Metric icon="₽" label="Фонд зарплаты" value="4 826 400 ₽" delta="+6,4% к июню" tone="cyan" />
        <Metric icon="◉" label="Сотрудников" value="42" delta="39 активных" tone="violet" />
        <Metric icon="◷" label="Часов отработано" value="6 784" delta="+248 часов" tone="amber" />
        <Metric icon="✓" label="Готовность расчёта" value="92%" delta="38 из 42 готово" tone="mint" progress={92} />
      </div>

      <div className="dashboard-grid">
        <article className="panel chart-panel">
          <PanelTitle title="Динамика фонда зарплаты" subtitle="За последние 6 месяцев" action="Все подразделения⌄" />
          <div className="chart">
            <div className="y-labels"><span>5 млн</span><span>4 млн</span><span>3 млн</span><span>2 млн</span><span>1 млн</span><span>0</span></div>
            <div className="chart-area">
              <div className="grid-lines"><i /><i /><i /><i /><i /></div>
              <svg viewBox="0 0 620 220" preserveAspectRatio="none" aria-label="График роста фонда зарплаты">
                <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#35c9ba" stopOpacity=".3" /><stop offset="100%" stopColor="#35c9ba" stopOpacity="0" /></linearGradient></defs>
                <path className="area-path" d="M10 158 C62 153,76 130,124 137 S196 123,232 111 S297 119,335 94 S403 83,448 67 S522 62,610 28 L610 220 L10 220 Z" />
                <path className="line-path" d="M10 158 C62 153,76 130,124 137 S196 123,232 111 S297 119,335 94 S403 83,448 67 S522 62,610 28" />
                {[["10","158"],["124","137"],["232","111"],["335","94"],["448","67"],["610","28"]].map(([cx,cy]) => <circle key={cx} cx={cx} cy={cy} r="5" />)}
              </svg>
              <div className="x-labels"><span>Фев</span><span>Мар</span><span>Апр</span><span>Май</span><span>Июн</span><span className="current">Июл</span></div>
            </div>
          </div>
        </article>

        <article className="panel status-panel">
          <PanelTitle title="Статус расчёта" subtitle="Июль 2026" action="Подробнее →" />
          <div className="donut-wrap">
            <div className="donut"><div><strong>92%</strong><span>готово</span></div></div>
            <div className="legend">
              <p><i className="mint-dot" /><span>Рассчитано</span><strong>38</strong></p>
              <p><i className="amber-dot" /><span>На проверке</span><strong>3</strong></p>
              <p><i className="grey-dot" /><span>Не начато</span><strong>1</strong></p>
            </div>
          </div>
          <div className="deadline"><span>◷</span><div><b>До закрытия периода</b><small>Осталось 2 дня</small></div><strong>01 авг</strong></div>
        </article>
      </div>

      <article className="panel employee-panel">
        <PanelTitle title="Последние расчёты" subtitle="Сотрудники с недавними изменениями" action="Показать всех →" />
        <EmployeeTable employees={employees.slice(0, 4)} />
      </article>
    </>
  );
}

function Metric({ icon, label, value, delta, tone, progress }: { icon: string; label: string; value: string; delta: string; tone: string; progress?: number }) {
  return <article className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><div className="metric-copy"><span>{label}</span><strong>{value}</strong><small className={tone === "amber" ? "neutral" : ""}>{delta}</small>{progress ? <div className="progress"><i style={{ width: `${progress}%` }} /></div> : null}</div></article>;
}

function PanelTitle({ title, subtitle, action }: { title: string; subtitle: string; action: string }) {
  return <div className="panel-title"><div><h2>{title}</h2><p>{subtitle}</p></div><button>{action}</button></div>;
}

function EmployeeTable({ employees: rows }: { employees: typeof employees }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Сотрудник</th><th>Должность / транспорт</th><th>Время</th><th>Начислено</th><th>Статус</th><th /></tr></thead>
        <tbody>{rows.map((employee) => <tr key={employee.name}><td><div className={`employee-avatar ${employee.tone}`}>{employee.initials}</div><strong>{employee.name}</strong></td><td><span>{employee.role}</span><small>{employee.unit}</small></td><td>{employee.hours}</td><td><b>{employee.amount}</b></td><td><span className={`badge ${employee.status === "На проверке" ? "badge-amber" : "badge-mint"}`}>{employee.status}</span></td><td><button aria-label={`Открыть ${employee.name}`}>›</button></td></tr>)}</tbody>
      </table>
    </div>
  );
}

function Payroll({ role, employees: rows }: { role: Role; employees: typeof employees }) {
  if (role === "driver") return <Overview role="driver" />;
  return <><div className="summary-strip"><div><span>Начислено</span><strong>5 284 200 ₽</strong></div><div><span>Удержания</span><strong>457 800 ₽</strong></div><div><span>К выплате</span><strong>4 826 400 ₽</strong></div><div><span>Дата выплаты</span><strong>05 августа</strong></div></div><article className="panel employee-panel"><PanelTitle title="Расчётная ведомость" subtitle={`${rows.length} сотрудников найдено`} action="↓ Экспорт XLSX" /><EmployeeTable employees={rows} /></article></>;
}

function Team({ employees: rows, search, setSearch }: { employees: typeof employees; search: string; setSearch: (value: string) => void }) {
  return <article className="panel employee-panel"><div className="table-toolbar"><div><h2>Команда</h2><p>Сотрудники, роли и назначенный транспорт</p></div><label className="search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Имя, роль, транспорт…" /></label></div><EmployeeTable employees={rows} /></article>;
}

function Trips({ role, compact = false }: { role: Role; compact?: boolean }) {
  const visible = role === "driver" ? trips.filter((trip) => trip.driver === "Михаил Козлов") : trips;
  return <article className={`panel trip-panel ${compact ? "compact-panel" : ""}`}><PanelTitle title={role === "driver" ? "Мои последние рейсы" : "Рейсы и смены"} subtitle={role === "driver" ? "Начисления включены в зарплату" : "Оперативный статус транспорта"} action="Календарь →" /><div className="trip-grid">{visible.map((trip) => <div className="trip-card" key={trip.id}><div className="route-icon">↗</div><div className="trip-main"><small>{trip.id}</small><strong>{trip.route}</strong><span>{trip.driver} · {trip.date}</span></div><div className="trip-end"><strong>{trip.amount}</strong><span className={`badge ${trip.status === "В пути" ? "badge-blue" : "badge-mint"}`}>{trip.status}</span></div></div>)}</div></article>;
}

function Reports() {
  const reports = [["Ведомость по зарплате", "XLSX · Июль 2026", "₽"], ["Реестр выплат", "CSV · 42 сотрудника", "▤"], ["Рейсы и километраж", "PDF · Июль 2026", "↗"], ["Налоги и удержания", "XLSX · Июль 2026", "%"]];
  return <div className="report-grid">{reports.map(([name, meta, icon]) => <article className="report-card" key={name}><div>{icon}</div><h2>{name}</h2><p>{meta}</p><button>Сформировать отчёт <span>→</span></button></article>)}</div>;
}
