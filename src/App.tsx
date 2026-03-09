import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Cloud, Trash2 } from "lucide-react";

import {
  addTransaction,
  removeTransaction,
  storageMode,
  subscribeToTransactions,
  type DebtTransaction,
  type TransactionType,
} from "@/lib/debtStore";
import { cn } from "@/utils/cn";

const currencyFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function formatBalance(amount: number) {
  if (amount < 0) {
    return `- ${currencyFormatter.format(Math.abs(amount))}`;
  }

  return currencyFormatter.format(amount);
}

function getTransactionCopy(type: TransactionType) {
  return type === "borrow"
    ? { action: "Начислить долг", label: "Брат занял", helper: "Когда брат берет деньги" }
    : { action: "Списать долг", label: "Брат вернул", helper: "Когда брат возвращает деньги" };
}

export function App() {
  const [transactions, setTransactions] = useState<DebtTransaction[]>([]);
  const [type, setType] = useState<TransactionType>("borrow");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeToTransactions(
      (nextTransactions) => {
        setTransactions(nextTransactions);
        setLoading(false);
      },
      () => {
        setErrorMessage("Не удалось загрузить операции. Проверь настройки Firebase.");
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  const balance = useMemo(
    () =>
      transactions.reduce((total, transaction) => {
        return total + (transaction.type === "borrow" ? transaction.amount : -transaction.amount);
      }, 0),
    [transactions],
  );

  const statusText =
    balance > 0 ? "Сейчас брат должен" : balance < 0 ? "Сейчас я должна брату" : "Сейчас вы в расчете";
  const typeCopy = getTransactionCopy(type);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage("Укажи сумму больше нуля.");
      return;
    }

    try {
      setSaving(true);
      setErrorMessage("");

      await addTransaction({
        amount: parsedAmount,
        note,
        type,
      });

      setAmount("");
      setNote("");
    } catch {
      setErrorMessage("Не получилось сохранить операцию.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(transactionId: string) {
    if (!window.confirm("Удалить эту операцию из истории?")) {
      return;
    }

    try {
      setErrorMessage("");
      await removeTransaction(transactionId);
    } catch {
      setErrorMessage("Не получилось удалить операцию.");
    }
  }

  return (
    <div className="min-h-screen bg-[#090b10] text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))]">
        <motion.header
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative overflow-hidden rounded-[36px] bg-[radial-gradient(circle_at_top,#1f2a44,transparent_55%),linear-gradient(180deg,#111827_0%,#090b10_70%)] px-5 pb-8 pt-6"
        >
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.38em] text-white/45">Debt Counter</p>
            <div className="space-y-2">
              <h1 className="text-4xl font-semibold tracking-tight">Долг брата</h1>
              <p className="max-w-[18rem] text-sm leading-6 text-white/60">
                Онлайн-счетчик в рублях для начисления и списания долга в одном телефоне.
              </p>
            </div>
          </div>

          <div className="mt-14 space-y-3">
            <p className="text-sm text-white/50">Текущий баланс</p>
            <AnimatePresence mode="wait">
              <motion.div
                key={balance}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
                className="text-[2.8rem] font-semibold tracking-tight"
              >
                {formatBalance(balance)}
              </motion.div>
            </AnimatePresence>
            <div className="flex items-center gap-2 text-sm text-white/65">
              {balance >= 0 ? <ArrowUpRight className="h-4 w-4 text-amber-300" /> : <ArrowDownLeft className="h-4 w-4 text-emerald-300" />}
              <span>{statusText}</span>
            </div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="flex items-center gap-2 text-xs text-white/45"
            >
              <Cloud className="h-3.5 w-3.5" />
              <span>
                {storageMode === "firebase"
                  ? "Синхронизация через Firebase включена"
                  : "Сейчас локальный режим. Добавь Firebase в .env для онлайн-базы."}
              </span>
            </motion.div>
          </div>
        </motion.header>

        <main className="mt-6 flex flex-1 flex-col gap-8">
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.55, ease: "easeOut" }}
            className="rounded-[30px] border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
          >
            <div className="mb-4 space-y-1">
              <h2 className="text-lg font-semibold">Новая операция</h2>
              <p className="text-sm text-white/50">{typeCopy.helper}</p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white/5 p-1">
                {(["borrow", "repay"] as const).map((option) => {
                  const optionCopy = getTransactionCopy(option);

                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setType(option)}
                      className={cn(
                        "rounded-[18px] px-4 py-3 text-sm font-medium transition",
                        option === type ? "bg-white text-slate-950" : "text-white/60",
                      )}
                    >
                      {optionCopy.label}
                    </button>
                  );
                })}
              </div>

              <label className="block space-y-2">
                <span className="text-sm text-white/65">Сумма, RUB</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="Например, 1500"
                  className="w-full rounded-2xl border border-white/10 bg-[#0f131a] px-4 py-3 text-base outline-none transition placeholder:text-white/25 focus:border-white/30"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm text-white/65">Комментарий</span>
                <input
                  type="text"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Например, на продукты"
                  className="w-full rounded-2xl border border-white/10 bg-[#0f131a] px-4 py-3 text-base outline-none transition placeholder:text-white/25 focus:border-white/30"
                />
              </label>

              {errorMessage ? <p className="text-sm text-rose-300">{errorMessage}</p> : null}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-2xl bg-white px-4 py-3 text-base font-medium text-slate-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Сохраняю..." : typeCopy.action}
              </button>
            </form>
          </motion.section>

          <section className="flex-1 space-y-3 pb-6">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">История</h2>
              <p className="text-sm text-white/50">Каждая запись сразу меняет общий долг.</p>
            </div>

            {loading ? (
              <div className="border-t border-white/10 py-5 text-sm text-white/45">Загрузка операций...</div>
            ) : transactions.length === 0 ? (
              <div className="border-t border-white/10 py-5 text-sm text-white/45">
                Пока пусто. Добавь первую сумму, когда брат снова займет деньги.
              </div>
            ) : (
              <motion.div layout className="divide-y divide-white/10 border-t border-white/10">
                <AnimatePresence initial={false}>
                  {transactions.map((transaction) => {
                    const isBorrow = transaction.type === "borrow";

                    return (
                      <motion.div
                        layout
                        key={transaction.id}
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 26 }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                        className="flex items-start justify-between gap-3 py-4"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "mt-0.5 flex h-10 w-10 items-center justify-center rounded-full border",
                              isBorrow ? "border-amber-300/25 bg-amber-300/10" : "border-emerald-300/25 bg-emerald-300/10",
                            )}
                          >
                            {isBorrow ? (
                              <ArrowUpRight className="h-4 w-4 text-amber-300" />
                            ) : (
                              <ArrowDownLeft className="h-4 w-4 text-emerald-300" />
                            )}
                          </div>

                          <div className="space-y-1">
                            <p className="font-medium text-white">{isBorrow ? "Брат занял" : "Брат вернул"}</p>
                            <p className="text-sm leading-5 text-white/55">
                              {transaction.note || (isBorrow ? "Без комментария" : "Возврат долга")}
                            </p>
                            <p className="text-xs uppercase tracking-[0.22em] text-white/35">
                              {dateFormatter.format(transaction.createdAt)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="text-right">
                            <p className={cn("font-medium", isBorrow ? "text-amber-200" : "text-emerald-200")}>
                              {isBorrow ? "+" : "-"}
                              {currencyFormatter.format(transaction.amount)}
                            </p>
                          </div>

                          <button
                            type="button"
                            aria-label="Удалить операцию"
                            onClick={() => handleRemove(transaction.id)}
                            className="rounded-full border border-white/10 p-2 text-white/45 transition hover:text-white"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
