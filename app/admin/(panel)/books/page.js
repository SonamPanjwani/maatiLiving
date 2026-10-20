import { redirect } from "next/navigation";

export default function BooksHome() {
  redirect("/admin/books/vendors");
}
