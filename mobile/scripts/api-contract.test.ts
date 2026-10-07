import { expect, test } from 'bun:test';
import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
const mobile = resolve(import.meta.dir, '..');
const root = resolve(mobile, '..');
const parse = (path: string) => ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, path.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const client = parse(join(mobile, 'src/api/client.ts'));
const imports = new Map<string, { file: string; name: string }>();
for (const statement of client.statements) if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text.startsWith('~backend/')) {
  const bindings = statement.importClause?.namedBindings;
  if (bindings && ts.isNamedImports(bindings)) for (const item of bindings.elements) imports.set(item.name.text, { file: join(root, statement.moduleSpecifier.text.replace('~backend/', 'backend/') + '.ts'), name: item.propertyName?.text ?? item.name.text });
}
function requiredFields(file: string, type: ts.TypeNode | undefined, depth = 0): string[] {
  if (!type || depth > 8) return [];
  const fields = (members: ts.NodeArray<ts.TypeElement>) => members.filter((m): m is ts.PropertySignature => ts.isPropertySignature(m) && !m.questionToken).map((m) => m.name.getText().replace(/['"]/g, ''));
  if (ts.isTypeLiteralNode(type)) return fields(type.members);
  if (ts.isIntersectionTypeNode(type)) return type.types.flatMap((t) => requiredFields(file, t, depth + 1));
  if (!ts.isTypeReferenceNode(type)) return [];
  const source = parse(file); const name = ts.isIdentifier(type.typeName) ? type.typeName.text : type.typeName.getText();
  for (const item of source.statements) {
    if (ts.isInterfaceDeclaration(item) && item.name.text === name) return fields(item.members);
    if (ts.isTypeAliasDeclaration(item) && item.name.text === name) return requiredFields(file, item.type, depth + 1);
    if (ts.isImportDeclaration(item) && ts.isStringLiteral(item.moduleSpecifier) && item.moduleSpecifier.text.startsWith('.')) {
      const bindings = item.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements) if (binding.name.text === name) return requiredFields(resolve(dirname(file), item.moduleSpecifier.text + '.ts'), ts.factory.createTypeReferenceNode(binding.propertyName?.text ?? name), depth + 1);
    }
  }
  return [];
}
const methods = new Map<string, string[]>();
for (const module of client.statements) if (ts.isModuleDeclaration(module) && module.body && ts.isModuleBlock(module.body)) for (const statement of module.body.statements) if (ts.isClassDeclaration(statement)) for (const member of statement.members) if (ts.isMethodDeclaration(member) && member.name && member.modifiers?.some((m) => m.kind === ts.SyntaxKind.PublicKeyword)) {
  const key = `${module.name.getText()}.${member.name.getText()}`;
  const type = member.parameters[0]?.type;
  const imported = type && ts.isTypeReferenceNode(type) && type.typeArguments?.[0] && ts.isTypeQueryNode(type.typeArguments[0]) ? imports.get(type.typeArguments[0].exprName.getText()) : undefined;
  let required: string[] = [];
  if (imported) {
    const source = parse(imported.file);
    for (const statement of source.statements) if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) if (declaration.name.getText() === imported.name && declaration.initializer && ts.isCallExpression(declaration.initializer)) required = requiredFields(imported.file, declaration.initializer.typeArguments?.[0]);
  }
  methods.set(key, required);
}
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.name === 'Game' || entry.name === 'api' ? [] : entry.isDirectory() ? files(join(dir, entry.name)) : /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [join(dir, entry.name)] : []);
const unwrap = (node: ts.Expression): ts.Expression => ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node) ? unwrap(node.expression) : node;

test('native API methods and required backend payload fields, excluding the game', () => {
  const errors: string[] = []; let checked = 0;
  for (const file of files(join(mobile, 'src'))) {
    const source = parse(file);
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const service = unwrap(node.expression.expression);
        if (ts.isPropertyAccessExpression(service) && unwrap(service.expression).getText(source) === 'backend') {
          checked += 1; const key = `${service.name.text}.${node.expression.name.text}`;
          const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
          if (!methods.has(key)) errors.push(`${file}:${line}: unknown method ${key}`);
          else {
            const argument = node.arguments[0] && unwrap(node.arguments[0]);
            if (argument && ts.isObjectLiteralExpression(argument) && !argument.properties.some(ts.isSpreadAssignment)) {
              const keys = argument.properties.map((p) => p.name?.getText(source).replace(/['"]/g, ''));
              for (const field of methods.get(key)!) if (!keys.includes(field)) errors.push(`${file}:${line}: ${key} requires ${field}`);
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    }; visit(source);
  }
  expect(checked).toBeGreaterThan(100);
  expect(errors).toEqual([]);
});
