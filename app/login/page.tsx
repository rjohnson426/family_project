import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in · Family Photos" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 border-t-4 border-t-[#115740] bg-white p-8 shadow-sm">
        <h1 className="font-serif text-3xl text-[#115740]">Family Photos</h1>
        <p className="mt-1 mb-6 text-stone-600">Enter the family password to continue.</p>
        <LoginForm next={typeof next === "string" ? next : "/"} />
      </div>
    </main>
  );
}
