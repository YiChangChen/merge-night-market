# Round 2 · Push 1 · Subtraction
刪減清單（12 項）：
1. spike 門檻只保留在 #4 一處。
2. 重複的「已驗證」只留一處。
3. React Compiler 的寫法規則移到 Implementation Patterns。
4. 「OTA 不阻塞啟動」移到 Core/Cross-cutting。
5. 每個 epic 的量測移到 Validation。
6. Web no-op 的做法移到 Cross-cutting 和廣告/埋點章節。
7. 刪除小版本號，以 package.json 為準。
8. 刪除「依 podspec 實際值」，這句和 16.4 矛盾。
9. 刪除「Expo Go 未上架」和重複的 `npx expo install` 規則（AGENTS.md 已有）。
10. 刪除 MCP 指令、OAuth 與方案細節。
11. 刪除「物理：不需要」一列。
12. 刪除 #7、#10 的括號附註。
## Findings
1. 門檻寫在兩處且不一致：完整版只放 #4，其他地方改為引用。
2. Compiler 規則埋在表格格子裡：移到 Implementation Patterns。
3. OTA、量測、Web no-op 放錯章節：移走。本節只保留 fingerprint 與「改原生依賴必須重建」。
4. 分層規則點名 Skia：改為「RN 與任何渲染/動畫函式庫」。
5. 會過時的細節（Expo Go、MCP 指令、小版本）和 iOS 的矛盾說法：刪除。
