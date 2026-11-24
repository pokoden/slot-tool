#!/usr/bin/env python3
"""共有タブの生成スクリプト。

使い方:
    python3 build.py <知識フォルダ> [出力フォルダ] [幸輔ルール集.mdのパス]

出力フォルダの既定値は、このスクリプトがあるフォルダ（ai-board/share/）。
幸輔ルール集.md は、3番目の引数で実体のパスを指定できる。指定が無ければ
知識フォルダの中を探し、無ければ対象外としてほかの生成を続ける。
許可したファイルだけをコピーし、秘密になりそうな行を除いて書き出す。
生成物: index.md（目次）、分類ごとの .md、all.txt（全部を連結したプレーンテキスト）。
"""
import re
import sys
from pathlib import Path

# 目次の順
CATEGORIES = [
    "共通ルール",
    "手順",
    "分析手法",
    "スロット",
    "パチンコ",
    "お金",
    "生活",
    "アプリ",
    "プロンプト",
    "リーダー・チーム運営",
]

# 許可するファイル（知識フォルダからの相対パス）→ 分類
ALLOW = {
    "幸輔ルール集.md": "共通ルール",
    "全ボット知識まとめ.md": "共通ルール",
    "担当の仕事手順書.md": "手順",
    "分析手法の知識.md": "分析手法",
    "スロット/機種.md": "スロット",
    "パチンコ/機種.md": "パチンコ",
    "パチンコ/引き継ぎ.md": "パチンコ",
    "アプリ/知識.md": "アプリ",
    "アプリ/手順メモ.md": "アプリ",
    "アプリ/版.md": "アプリ",
    "プロンプト君.md": "プロンプト",
    "チーム運営の知識.md": "リーダー・チーム運営",
    "リーダーの役割.md": "リーダー・チーム運営",
}

# 名前にこれらが含まれるファイルは、許可リストにあっても出さない
DENY_NAME = [
    "家系図",
    "扶養",
    "固定費",
    "収支",
    "予定",
    "vault",
    "invite",
    "token",
    "トークン",
    "パスワード",
    "backup",
    ".bak",
]

# 秘密になりそうな行（この正規表現に当たった行は落とす）
SECRET_LINE = re.compile(
    r"(トークン|パスワード|password|passwd|api[\s_\-]?key|secret|bearer|"
    r"ghp_[A-Za-z0-9]|github_pat_|AIza|AQ\.|電話|住所|生年月日|口座|カード番号|"
    r"メールアドレス|扶養|固定費の内訳)",
    re.IGNORECASE,
)


def clean_lines(text: str) -> str:
    kept = [ln for ln in text.splitlines() if not SECRET_LINE.search(ln)]
    return "\n".join(kept).strip() + "\n"


def main() -> int:
    if len(sys.argv) < 2:
        print("使い方: python3 build.py <知識フォルダ> [出力フォルダ] [幸輔ルール集.mdのパス]")
        return 1
    src = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).parent
    if not src.is_dir():
        print(f"知識フォルダが見つからない: {src}")
        return 1
    out.mkdir(parents=True, exist_ok=True)

    rules_rel = "幸輔ルール集.md"
    rules_path = Path(sys.argv[3]) if len(sys.argv) > 3 else src / rules_rel

    by_cat: dict[str, list[tuple[str, str]]] = {c: [] for c in CATEGORIES}
    skipped = []
    for rel, cat in ALLOW.items():
        if rel == rules_rel:
            continue
        name_hit = any(d in rel for d in DENY_NAME)
        path = src / rel
        if name_hit or not path.is_file():
            skipped.append(rel)
            continue
        by_cat[cat].append((rel, clean_lines(path.read_text(encoding="utf-8"))))

    if rules_path.is_file():
        by_cat["共通ルール"].insert(
            0, (rules_rel, clean_lines(rules_path.read_text(encoding="utf-8")))
        )
    else:
        skipped.append(rules_rel)
        print(f"幸輔ルール集.md が見つからないため対象外にした: {rules_path}")

    written = []
    all_parts = ["共有\n"]
    index_lines = ["# 共有", ""]
    for cat in CATEGORIES:
        files = by_cat[cat]
        if not files:
            continue
        body = f"# {cat}\n"
        for rel, text in files:
            body += f"\n## {Path(rel).stem}\n\n{text}"
        (out / f"{cat}.md").write_text(body, encoding="utf-8")
        written.append(f"{cat}.md")
        index_lines.append(f"- [{cat}]({cat}.md)")
        all_parts.append(f"\n# {cat}\n")
        for rel, text in files:
            plain = re.sub(r"^#{1,6}\s*", "", text, flags=re.M)
            all_parts.append(f"\n## {Path(rel).stem}\n\n{plain}")
    index_lines.append("- [全部（all.txt）](all.txt)")
    (out / "index.md").write_text("\n".join(index_lines) + "\n", encoding="utf-8")
    (out / "all.txt").write_text("".join(all_parts), encoding="utf-8")
    written += ["index.md", "all.txt"]

    print("書き出した:", ", ".join(written))
    if skipped:
        print("飛ばした（無い／対象外）:", ", ".join(skipped))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

