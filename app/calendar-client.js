
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";

const CAT = {
  study: "📚 공부",
  life: "🏠 생활",
  club: "👥 동아리",
  meeting: "🎉 약속",
  other: "📌 기타",
};

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

const pad = (n) => String(n).padStart(2, "0");

const toStr = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const parse = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const label = (d) =>
  `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`;

const ddayLabel = (s) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const n = Math.round((parse(s) - today) / 864e5);

  return n === 0 ? "D-Day" : n > 0 ? `D-${n}` : `D+${-n}`;
};

export default function CalendarClient({ initialUser }) {
  const supabase = useMemo(() => createClient(), []);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(toStr(new Date()));

  const [todos, setTodos] = useState([]);
  const [ddays, setDdays] = useState([]);

  const [currentUser, setCurrentUser] = useState(initialUser);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [todoErr, setTodoErr] = useState("");
  const [ddErr, setDdErr] = useState("");

  const [todoText, setTodoText] = useState("");
  const [todoDate, setTodoDate] = useState(toStr(new Date()));
  const [todoCategory, setTodoCategory] = useState("study");

  const [ddText, setDdText] = useState("");
  const [ddDate, setDdDate] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setAuthMessage(error.message);
      }

      if (!mounted) return;

      setCurrentUser(data.session?.user ?? null);
      setIsLoading(false);
    }

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;

      setCurrentUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    async function loadTodos() {
      if (!currentUser) {
        setTodos([]);
        return;
      }

      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("date", { ascending: true });

      if (error) {
        setTodoErr(error.message);
        return;
      }

      setTodos(data || []);
    }

    loadTodos();
  }, [currentUser, supabase]);

  useEffect(() => {
    async function loadDdays() {
      if (!currentUser) {
        setDdays([]);
        return;
      }

      const { data, error } = await supabase
        .from("ddays")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("target_date", { ascending: true });

      if (error) {
        setDdErr(error.message);
        return;
      }

      setDdErr("");
      setDdays(
        (data || []).map((item) => ({
          id: item.id,
          text: item.title,
          date: item.target_date,
        }))
      );
    }

    loadDdays();
  }, [currentUser, supabase]);

  async function signUp() {
    if (!authEmail.trim() || !authPassword) {
      setAuthMessage("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: authEmail.trim(),
      password: authPassword,
    });

    setAuthMessage(
      error
        ? error.message
        : "회원가입 요청 완료! 이메일 인증이 필요할 수 있습니다."
    );
  }

  async function signIn() {
    if (!authEmail.trim() || !authPassword) {
      setAuthMessage("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail.trim(),
      password: authPassword,
    });

    setAuthMessage(error ? error.message : "");
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) setAuthMessage(error.message);
  }

  async function addTodo() {
    if (!currentUser) {
      setTodoErr("먼저 로그인해주세요.");
      return;
    }

    if (!todoText.trim() || !todoDate) {
      setTodoErr(
        !todoText.trim()
          ? "할 일 내용을 입력해주세요."
          : "날짜를 선택해주세요."
      );
      return;
    }

    const { data, error } = await supabase
      .from("todos")
      .insert({
        user_id: currentUser.id,
        text: todoText.trim(),
        date: todoDate,
        category: todoCategory,
        completed: false,
      })
      .select()
      .single();

    if (error) {
      setTodoErr("저장 실패: " + error.message);
      return;
    }

    setTodos((prev) => [...prev, data]);
    setTodoText("");
    setTodoErr("");
    selectDate(todoDate);
  }

  async function toggleTodo(todo) {
    if (!currentUser) return;

    const nextCompleted = !todo.completed;

    setTodos((prev) =>
      prev.map((t) =>
        t.id === todo.id ? { ...t, completed: nextCompleted } : t
      )
    );

    const { error } = await supabase
      .from("todos")
      .update({ completed: nextCompleted })
      .eq("id", todo.id)
      .eq("user_id", currentUser.id);

    if (error) {
      setTodos((prev) =>
        prev.map((t) =>
          t.id === todo.id ? { ...t, completed: todo.completed } : t
        )
      );

      alert("저장 실패: " + error.message);
    }
  }

  async function deleteTodo(todo) {
    if (!currentUser) return;

    const { error } = await supabase
      .from("todos")
      .delete()
      .eq("id", todo.id)
      .eq("user_id", currentUser.id);

    if (error) {
      alert("삭제 실패: " + error.message);
      return;
    }

    setTodos((prev) => prev.filter((t) => t.id !== todo.id));
  }

  function selectDate(ds) {
    setSelectedDate(ds);
    setTodoDate(ds);

    const d = parse(ds);
    setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
  }

  function goToday() {
    selectDate(toStr(new Date()));
  }

  function move(n) {
    setCurrentDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + n, 1)
    );
  }

  async function addDday() {
    if (!currentUser) {
      setDdErr("먼저 로그인해주세요.");
      return;
    }

    if (!ddText.trim() || !ddDate) {
      setDdErr(
        !ddText.trim() ? "이름을 입력해주세요." : "날짜를 선택해주세요."
      );
      return;
    }

    const { data, error } = await supabase
      .from("ddays")
      .insert({
        user_id: currentUser.id,
        title: ddText.trim(),
        target_date: ddDate,
      })
      .select()
      .single();

    if (error) {
      setDdErr(error.message);
      return;
    }

    setDdays((prev) => [
      ...prev,
      {
        id: data.id,
        text: data.title,
        date: data.target_date,
      },
    ]);

    setDdText("");
    setDdDate("");
    setDdErr("");
    selectDate(ddDate);
  }

  async function deleteDday(id) {
    const { error } = await supabase
      .from("ddays")
      .delete()
      .eq("id", id)
      .eq("user_id", currentUser.id);

    if (error) {
      setDdErr(error.message);
      return;
    }

    setDdays((prev) => prev.filter((x) => x.id !== id));
    setDdErr("");
  }

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const first = new Date(year, month, 1).getDay();
  const last = new Date(year, month + 1, 0).getDate();
  const todayStr = toStr(new Date());

  const calendarCells = [];

  for (let i = 0; i < first; i++) {
    calendarCells.push(
      <div key={`blank-${i}`} className="day blank" />
    );
  }

  for (let d = 1; d <= last; d++) {
    const ds = `${year}-${pad(month + 1)}-${pad(d)}`;
    const items = todos.filter((t) => t.date === ds);

    calendarCells.push(
      <div
        key={ds}
        className={`day ${ds === todayStr ? "today" : ""} ${
          ds === selectedDate ? "selected" : ""
        }`}
        onClick={() => selectDate(ds)}
      >
        <div className="day-number">{d}</div>

        {ddays
          .filter((x) => x.date === ds)
          .map((x) => (
            <div key={x.id} className="dd-badge">
              ⏳ {x.text}
            </div>
          ))}

        <div className="chips">
          {items.slice(0, 2).map((todo) => (
            <div
              key={todo.id}
              className={`chip category-${todo.category} ${
                todo.completed ? "completed" : ""
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleTodo(todo)}
              />
              <span>{todo.text}</span>
            </div>
          ))}

          {items.length > 2 && (
            <div className="more">+{items.length - 2}개 더</div>
          )}
        </div>

        <div className="dots">
          {items.slice(0, 6).map((todo) => (
            <i
              key={todo.id}
              className={todo.completed ? "done" : ""}
            />
          ))}
        </div>
      </div>
    );
  }

  const dailyItems = todos.filter((t) => t.date === selectedDate);
  const doneCount = dailyItems.filter((t) => t.completed).length;

  const sortedDdays = [...ddays].sort((a, b) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const x = parse(a.date) - today;
    const y = parse(b.date) - today;

    if ((x >= 0) !== (y >= 0)) return x >= 0 ? -1 : 1;

    return Math.abs(x) - Math.abs(y);
  });

  if (isLoading) {
    return <div className="container">불러오는 중...</div>;
  }

  return (
    <div className="container">
      <div className="title-area">
        <h1>My Calendar</h1>
        <p>
          캘린더에서 한눈에 보고, 날짜를 눌러 오른쪽에서 그날의 할 일을 체크하세요.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        {currentUser ? (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span>{currentUser.email}</span>
            <button className="btn ghost" onClick={signOut}>
              로그아웃
            </button>
          </div>
        ) : (
          <div>
            <div className="input-title">로그인 / 회원가입</div>

            <div className="input-area">
              <label className="f grow">
                이메일
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="이메일 입력"
                />
              </label>

              <label className="f grow">
                비밀번호
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="비밀번호 입력"
                />
              </label>

              <button className="btn" onClick={signUp}>
                회원가입
              </button>

              <button className="btn ghost" onClick={signIn}>
                로그인
              </button>
            </div>

            <div className="err">{authMessage}</div>
          </div>
        )}
      </div>

      <div className="card input-card">
        <div className="input-title">
          할 일 추가
          <span className="hint">내용 · 날짜 · 분류를 고르고 추가해요</span>
        </div>

        <div className="input-area">
          <label className="f grow">
            할 일
            <input
              type="text"
              value={todoText}
              onChange={(e) => setTodoText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTodo();
              }}
              placeholder="예: 이산수학 과제 제출"
            />
          </label>

          <label className="f">
            날짜
            <input
              type="date"
              id="todoDate"
              value={todoDate}
              onChange={(e) => setTodoDate(e.target.value)}
            />
          </label>

          <label className="f">
            분류
            <select
              id="todoCategory"
              value={todoCategory}
              onChange={(e) => setTodoCategory(e.target.value)}
            >
              {Object.entries(CAT).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <button className="btn add" onClick={addTodo}>
            + 할 일 추가
          </button>
        </div>

        <div className="err">{todoErr}</div>
      </div>

      <div className="main">
        <div className="card">
          <div className="cal-head">
            <h2>
              {year}년 {month + 1}월
            </h2>

            <div className="tools">
              <button className="sm" onClick={goToday}>
                오늘
              </button>
              <button className="sm" aria-label="이전" onClick={() => move(-1)}>
                ‹
              </button>
              <button className="sm" aria-label="다음" onClick={() => move(1)}>
                ›
              </button>
            </div>
          </div>

          <div>
            <div className="weekdays">
              {WEEK.map((day) => (
                <div key={day} className="weekday">
                  {day}
                </div>
              ))}
            </div>

            <div className="days">{calendarCells}</div>
          </div>
        </div>

        <div className="side">
          <div className="card">
            <h3>
              ⏳ 디데이
              <small>시험·마감 같은 중요한 날</small>
            </h3>

            <div className="dd-form">
              <input
                type="text"
                value={ddText}
                onChange={(e) => setDdText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addDday();
                }}
                placeholder="예: 중간고사"
                aria-label="디데이 이름"
              />

              <div className="row">
                <input
                  type="date"
                  value={ddDate}
                  onChange={(e) => setDdDate(e.target.value)}
                  aria-label="디데이 날짜"
                />

                <button className="btn ghost" onClick={addDday}>
                  + 디데이 추가
                </button>
              </div>

              <div className="err" style={{ margin: 0 }}>
                {ddErr}
              </div>
            </div>

            <div className="dd-list">
              {sortedDdays.length === 0 ? (
                <div className="empty">중요한 날을 등록해보세요</div>
              ) : (
                sortedDdays.map((d) => (
                  <div
                    key={d.id}
                    className={`dd-item ${
                      parse(d.date) < new Date(new Date().setHours(0, 0, 0, 0))
                        ? "past"
                        : ""
                    }`}
                    onClick={() => selectDate(d.date)}
                  >
                    <div className="count">{ddayLabel(d.date)}</div>

                    <div className="info">
                      <div className="name">{d.text}</div>
                      <div className="date">{d.date}</div>
                    </div>

                    <button
                      className="del"
                      aria-label="디데이 삭제"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteDday(d.id);
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card daily-card">
            <h3>
              <span>{label(parse(selectedDate))}</span>
              <small>
                {dailyItems.length
                  ? `${doneCount}/${dailyItems.length} 완료`
                  : ""}
              </small>
            </h3>

            <div className="daily-list">
              {ddays
                .filter((x) => x.date === selectedDate)
                .map((x) => (
                  <div key={x.id} className="daily-dd">
                    ⏳ {x.text} · D-Day
                  </div>
                ))}

              {dailyItems.map((todo) => (
                <div
                  key={todo.id}
                  className={`daily-item category-${todo.category} ${
                    todo.completed ? "completed" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => toggleTodo(todo)}
                  />

                  <span className="t">{todo.text}</span>
                  <span className="tag">{CAT[todo.category]}</span>

                  <button
                    className="del"
                    aria-label="삭제"
                    onClick={() => deleteTodo(todo)}
                  >
                    🗑️
                  </button>
                </div>
              ))}

              {dailyItems.length === 0 &&
                !ddays.some((x) => x.date === selectedDate) && (
                  <div className="empty">
                    이 날의 할 일이 없어요. 위에서 추가해보세요.
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
