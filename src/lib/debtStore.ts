import { getApp, getApps, initializeApp } from "firebase/app";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  type Firestore,
} from "firebase/firestore";

export type TransactionType = "borrow" | "repay";

export type DebtTransaction = {
  id: string;
  type: TransactionType;
  amount: number;
  note: string;
  createdAt: number;
};

type NewDebtTransaction = Omit<DebtTransaction, "id" | "createdAt">;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean);
const collectionName = import.meta.env.VITE_FIREBASE_COLLECTION || "brotherDebtTransactions";
const localStorageKey = "brother-debt-transactions";
const localSyncEvent = "brother-debt-transactions:changed";

const db: Firestore | null = hasFirebaseConfig
  ? getFirestore(getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null;

export const storageMode = db ? "firebase" : "local";

function normalizeTransaction(input: Partial<DebtTransaction> & { id: string }): DebtTransaction {
  return {
    id: input.id,
    type: input.type === "repay" ? "repay" : "borrow",
    amount: Number.isFinite(input.amount) ? Math.max(0, Number(input.amount)) : 0,
    note: typeof input.note === "string" ? input.note : "",
    createdAt: Number.isFinite(input.createdAt) ? Number(input.createdAt) : Date.now(),
  };
}

function readLocalTransactions(): DebtTransaction[] {
  if (typeof window === "undefined") {
    return [];
  }

  const rawValue = window.localStorage.getItem(localStorageKey);

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as Array<Partial<DebtTransaction> & { id: string }>;

    return parsed
      .map((item) => normalizeTransaction(item))
      .sort((left, right) => right.createdAt - left.createdAt);
  } catch {
    return [];
  }
}

function writeLocalTransactions(transactions: DebtTransaction[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(localStorageKey, JSON.stringify(transactions));
  window.dispatchEvent(new Event(localSyncEvent));
}

export function subscribeToTransactions(
  onData: (transactions: DebtTransaction[]) => void,
  onError: (error: Error) => void,
) {
  if (db) {
    const transactionsQuery = query(collection(db, collectionName), orderBy("createdAt", "desc"));

    return onSnapshot(
      transactionsQuery,
      (snapshot) => {
        const nextTransactions = snapshot.docs.map((snapshotDoc) =>
          normalizeTransaction({ id: snapshotDoc.id, ...(snapshotDoc.data() as Partial<DebtTransaction>) }),
        );

        onData(nextTransactions);
      },
      (error) => onError(error),
    );
  }

  onData(readLocalTransactions());

  const syncLocalTransactions = () => onData(readLocalTransactions());

  window.addEventListener("storage", syncLocalTransactions);
  window.addEventListener(localSyncEvent, syncLocalTransactions);

  return () => {
    window.removeEventListener("storage", syncLocalTransactions);
    window.removeEventListener(localSyncEvent, syncLocalTransactions);
  };
}

export async function addTransaction(transaction: NewDebtTransaction) {
  const payload = {
    amount: Math.round(transaction.amount),
    note: transaction.note.trim(),
    type: transaction.type,
    createdAt: Date.now(),
  };

  if (db) {
    await addDoc(collection(db, collectionName), payload);
    return;
  }

  const nextTransactions = [{ id: crypto.randomUUID(), ...payload }, ...readLocalTransactions()];
  writeLocalTransactions(nextTransactions);
}

export async function removeTransaction(id: string) {
  if (db) {
    await deleteDoc(doc(db, collectionName, id));
    return;
  }

  const nextTransactions = readLocalTransactions().filter((transaction) => transaction.id !== id);
  writeLocalTransactions(nextTransactions);
}