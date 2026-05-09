import { NextResponse } from "next/server";
import { requireApUser } from "@/lib/session";
import { extractDepartmentImportHeaders } from "@/lib/department-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await requireApUser();
  const formData = await request.formData();
  const file = formData.get("departmentFile");
  const headerRow = Math.max(Number(formData.get("headerRow")) || 1, 1);

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({
      headers: [],
      errors: ["Select a department file to preview."],
    });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({
      headers: [],
      errors: ["Department file preview is limited to 10 MB."],
    });
  }

  if (!/\.(csv|xlsx|xls)$/i.test(file.name)) {
    return NextResponse.json({
      headers: [],
      errors: ["Department file must be a CSV or Excel file."],
    });
  }

  const result = await extractDepartmentImportHeaders(file, headerRow);
  return NextResponse.json(result);
}
