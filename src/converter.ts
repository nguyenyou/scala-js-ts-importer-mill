import * as ts from 'typescript'
import CodeBlockWriter from 'code-block-writer'

export function convertTsToScala(input: string, packageName: string): string {
  // Parse TypeScript input
  const sourceFile = ts.createSourceFile(
    'input.d.ts',
    input,
    ts.ScriptTarget.Latest,
    true
  )

  // Create code writer
  const writer = new CodeBlockWriter({
    indentNumberOfSpaces: 2,
    newLine: '\n'
  })

  // Generate Scala output
  generateScalaOutput(sourceFile, writer, packageName)

  return writer.toString()
}

function generateScalaOutput(sourceFile: ts.SourceFile, writer: CodeBlockWriter, packageName: string): void {
  // Write standard imports
  writer.writeLine('')
  writer.writeLine('import scala.scalajs.js')
  writer.writeLine('import js.annotation._')
  writer.writeLine('import js.|')
  writer.writeLine('')

  // Write package declaration
  const reservedWords = ['abstract', 'case', 'catch', 'class', 'def', 'do', 'else', 'extends', 'false', 'final', 'finally', 'for', 'forSome', 'if', 'implicit', 'import', 'lazy', 'macro', 'match', 'new', 'null', 'object', 'override', 'package', 'private', 'protected', 'return', 'sealed', 'super', 'then', 'this', 'throw', 'trait', 'try', 'true', 'type', 'val', 'var', 'while', 'with', 'yield']
  const packageDeclaration = packageName.includes('-') || !packageName.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/) || reservedWords.includes(packageName)
    ? `package \`${packageName}\`` 
    : `package ${packageName}`
    
  writer.write(`${packageDeclaration} `).block(() => {
    // Collect top-level exports for global scope object
    const topLevelExports: {interfaces: ts.InterfaceDeclaration[], types: ts.TypeAliasDeclaration[], classes: ts.ClassDeclaration[], functions: ts.FunctionDeclaration[], exportAssignments: ts.ExportAssignment[]} = {
      interfaces: [],
      types: [],
      classes: [],
      functions: [],
      exportAssignments: []
    }
    
    // Process top-level declarations and collect exports
    sourceFile.statements.forEach(statement => {
      if (hasExportModifier(statement)) {
        if (ts.isInterfaceDeclaration(statement)) {
          topLevelExports.interfaces.push(statement)
        } else if (ts.isTypeAliasDeclaration(statement)) {
          topLevelExports.types.push(statement)
        } else if (ts.isClassDeclaration(statement)) {
          topLevelExports.classes.push(statement)
        }
      }
      
      // Collect functions and export assignments
      if (ts.isFunctionDeclaration(statement)) {
        topLevelExports.functions.push(statement)
      } else if (ts.isExportAssignment(statement)) {
        topLevelExports.exportAssignments.push(statement)
      }
      
      processStatement(statement, writer, '')
    })
    
    // Generate global scope object if there are top-level exports or export assignments
    if (topLevelExports.types.length > 0 || topLevelExports.exportAssignments.length > 0) {
      generateGlobalScopeObject(packageName, topLevelExports, writer)
    }
    
    // Add blank line before closing package brace
    writer.setIndentationLevel(0)
    writer.newLine()
    
    // Add extra blank line for module-based structure (when there are modules)
    const hasModules = sourceFile.statements.some(stmt => ts.isModuleDeclaration(stmt))
    if (hasModules) {
      writer.newLine()
    }
  })
}

function processStatement(statement: ts.Statement, writer: CodeBlockWriter, namespace: string): void {
  switch (statement.kind) {
    case ts.SyntaxKind.ModuleDeclaration:
      processModuleDeclaration(statement as ts.ModuleDeclaration, writer, namespace)
      break
    case ts.SyntaxKind.ClassDeclaration:
      processClassDeclaration(statement as ts.ClassDeclaration, writer, namespace)
      break
    case ts.SyntaxKind.InterfaceDeclaration:
      processInterfaceDeclaration(statement as ts.InterfaceDeclaration, writer, namespace)
      break
    case ts.SyntaxKind.EnumDeclaration:
      processEnumDeclaration(statement as ts.EnumDeclaration, writer, namespace)
      break
    case ts.SyntaxKind.TypeAliasDeclaration:
      processTypeAliasDeclaration(statement as ts.TypeAliasDeclaration, writer, namespace)
      break
    case ts.SyntaxKind.VariableStatement:
      processVariableStatement(statement as ts.VariableStatement, writer, namespace)
      break
    case ts.SyntaxKind.FunctionDeclaration:
      processFunctionDeclaration(statement as ts.FunctionDeclaration, writer, namespace)
      break
    case ts.SyntaxKind.ExportDeclaration:
      // Usually handled within module declarations
      break
    case ts.SyntaxKind.ExportAssignment:
      processExportAssignment(statement as ts.ExportAssignment, writer, namespace)
      break
    default:
      // Skip unhandled statement types
      break
  }
}

function processModuleDeclaration(node: ts.ModuleDeclaration, writer: CodeBlockWriter, namespace: string): void {
  const moduleName = node.name.getText()
  const newNamespace = namespace ? `${namespace}.${moduleName}` : moduleName
  
  writer.newLine()
  const currentIndentLevel = writer.getIndentationLevel()
  writer.setIndentationLevel(0)
  writer.write(`package ${moduleName} `).block(() => {
    
    if (node.body && ts.isModuleBlock(node.body)) {
      // Collect exports for module object
      const exports: {interfaces: ts.InterfaceDeclaration[], types: ts.TypeAliasDeclaration[]} = {
        interfaces: [],
        types: []
      }
      
      // Process declarations and collect exports
      node.body.statements.forEach(statement => {
        if (hasExportModifier(statement)) {
          if (ts.isInterfaceDeclaration(statement)) {
            exports.interfaces.push(statement)
          } else if (ts.isTypeAliasDeclaration(statement)) {
            exports.types.push(statement)
          }
        }
        processStatement(statement, writer, newNamespace)
      })
      
      // Generate module object if there are exports
      if (exports.types.length > 0) {
        generateModuleObject(moduleName, exports, writer)
      }
    }
    
    // Add blank line before closing package brace
    writer.setIndentationLevel(0)
    writer.newLine()
  })
  writer.setIndentationLevel(currentIndentLevel)
}

function processClassDeclaration(node: ts.ClassDeclaration, writer: CodeBlockWriter, namespace: string): void {
  const className = node.name?.getText() || 'AnonymousClass'
  const isAbstract = node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AbstractKeyword)
  const isExport = hasExportModifier(node)
  
  // Skip processing if it's a top-level export (will be handled in global scope object)
  if (isExport && !namespace) {
    writer.newLine()
    const currentIndentLevel = writer.getIndentationLevel()
    writer.setIndentationLevel(0)
    writer.write('@js.native').newLine()
    writer.write('@JSGlobal').newLine()
    writer.write(`${isAbstract ? 'abstract ' : ''}class ${className} extends js.Object `).block(() => {
      node.members.forEach(member => {
        processClassMember(member, writer, isAbstract)
      })
    })
    writer.newLine()
    writer.setIndentationLevel(currentIndentLevel)
    return
  }
  
  // Write annotations at base indentation level
  writer.newLine()
  const currentIndentLevel = writer.getIndentationLevel()
  writer.setIndentationLevel(0)
  writer.write('@js.native').newLine()
  writer.write('@JSGlobal').newLine()
  writer.write(`${isAbstract ? 'abstract ' : ''}class ${className} extends js.Object `).block(() => {
    node.members.forEach(member => {
      processClassMember(member, writer, isAbstract)
    })
  })
  writer.newLine()
  writer.setIndentationLevel(currentIndentLevel)
}

function processInterfaceDeclaration(node: ts.InterfaceDeclaration, writer: CodeBlockWriter, namespace: string): void {
  const interfaceName = node.name.getText()
  const isExport = hasExportModifier(node)
  
  // For exported interfaces in modules, no @JSGlobal annotation
  if (isExport) {
    writer.newLine()
    const currentIndentLevel = writer.getIndentationLevel()
    writer.setIndentationLevel(0)
    writer.write('@js.native').newLine()
    writer.write(`trait ${interfaceName} extends js.Object `).block(() => {
      processInterfaceMembersWithDeduplication(node.members, writer)
    })
    writer.newLine()
    writer.setIndentationLevel(currentIndentLevel)
    return
  }
  
  writer.newLine()
  const currentIndentLevel = writer.getIndentationLevel()
  writer.setIndentationLevel(0)
  writer.write('@js.native').newLine()
  writer.write('@JSGlobal').newLine()
  writer.write(`trait ${interfaceName} extends js.Object `).block(() => {
    processInterfaceMembersWithDeduplication(node.members, writer)
  })
  writer.newLine()
  writer.setIndentationLevel(currentIndentLevel)
}

function processClassMember(member: ts.ClassElement, writer: CodeBlockWriter, isAbstractClass?: boolean): void {
  switch (member.kind) {
    case ts.SyntaxKind.PropertyDeclaration:
      processPropertyDeclaration(member as ts.PropertyDeclaration, writer)
      break
    case ts.SyntaxKind.MethodDeclaration:
      processMethodDeclaration(member as ts.MethodDeclaration, writer, isAbstractClass)
      break
  }
}

function processInterfaceMember(member: ts.TypeElement, writer: CodeBlockWriter): void {
  switch (member.kind) {
    case ts.SyntaxKind.PropertySignature:
      processPropertySignature(member as ts.PropertySignature, writer)
      break
    case ts.SyntaxKind.MethodSignature:
      processMethodSignature(member as ts.MethodSignature, writer)
      break
  }
}

function processPropertyDeclaration(node: ts.PropertyDeclaration, writer: CodeBlockWriter): void {
  const name = node.name.getText()
  const typeText = node.type ? convertTypeToScala(node.type) : 'js.Any'
  writer.writeLine(`var ${name}: ${typeText}`)
}

function processPropertySignature(node: ts.PropertySignature, writer: CodeBlockWriter): void {
  const name = node.name.getText()
  const typeText = node.type ? convertTypeToScala(node.type) : 'js.Any'
  writer.writeLine(`var ${name}: ${typeText} = js.native`)
}

function processMethodDeclaration(node: ts.MethodDeclaration, writer: CodeBlockWriter, isAbstractClass?: boolean): void {
  const name = node.name.getText()
  const params = node.parameters.map(p => {
    const paramName = p.name.getText()
    const paramType = p.type ? convertTypeToScala(p.type) : 'js.Any'
    return `${paramName}: ${paramType}`
  }).join(', ')
  
  const returnType = node.type ? convertTypeToScala(node.type) : 'Unit'
  
  // Abstract class methods don't have implementations
  const implementation = isAbstractClass ? '' : ' = js.native'
  writer.writeLine(`def ${name}(${params}): ${returnType}${implementation}`)
}

function processMethodSignature(node: ts.MethodSignature, writer: CodeBlockWriter): void {
  const name = node.name.getText()
  const params = node.parameters.map(p => {
    const paramName = p.name.getText()
    const paramType = p.type ? convertTypeToScala(p.type) : 'js.Any'
    return `${paramName}: ${paramType}`
  }).join(', ')
  
  const returnType = node.type ? convertTypeToScala(node.type) : 'Unit'
  writer.writeLine(`def ${name}(${params}): ${returnType} = js.native`)
}

function processEnumDeclaration(node: ts.EnumDeclaration, writer: CodeBlockWriter, namespace: string): void {
  const enumName = node.name.getText()
  const isExport = hasExportModifier(node)
  
  // Generate sealed trait
  writer.newLine()
  const currentIndentLevel = writer.getIndentationLevel()
  writer.setIndentationLevel(0)
  writer.write('@js.native').newLine()
  writer.write(`sealed trait ${enumName} extends js.Object `).block(() => {
    // Empty trait body
  })
  writer.newLine()
  writer.newLine()
  writer.write('@js.native').newLine()
  if (namespace) {
    writer.write(`@JSGlobal("${namespace}.${enumName}")`).newLine()
  } else {
    writer.write(`@JSGlobal("${enumName}")`).newLine()
  }
  writer.write(`object ${enumName} extends js.Object `).block(() => {
    // Generate variables for each enum member
    node.members.forEach(member => {
      const memberName = member.name?.getText()
      if (memberName) {
        writer.writeLine(`var ${memberName}: ${enumName} = js.native`)
      }
    })
    
    // Generate JSBracketAccess apply method
    writer.writeLine('@JSBracketAccess')
    writer.writeLine(`def apply(value: ${enumName}): String = js.native`)
  })
  writer.newLine()
  writer.setIndentationLevel(currentIndentLevel)
}

function processTypeAliasDeclaration(node: ts.TypeAliasDeclaration, writer: CodeBlockWriter, namespace: string): void {
  // Type aliases are handled in module/global scope objects for exports
  if (hasExportModifier(node)) {
    return // Skip processing here, will be handled in module/global scope object
  }
  
  const typeName = node.name.getText()
  const typeValue = convertTypeToScala(node.type)
  
  writer.newLine()
  const currentIndentLevel = writer.getIndentationLevel()
  writer.setIndentationLevel(0)
  writer.write(`type ${typeName} = ${typeValue}`).newLine()
  writer.setIndentationLevel(currentIndentLevel)
}

function processVariableStatement(node: ts.VariableStatement, writer: CodeBlockWriter, namespace: string): void {
  // TODO: Implement variable statement processing
}

function processFunctionDeclaration(node: ts.FunctionDeclaration, writer: CodeBlockWriter, namespace: string): void {
  const functionName = node.name?.getText()
  if (!functionName) return
  
  // Functions will be collected for global scope object
  // We'll handle this in a different way for export assignments
}

function convertTypeToScala(typeNode: ts.TypeNode): string {
  switch (typeNode.kind) {
    case ts.SyntaxKind.StringKeyword:
      return 'String'
    case ts.SyntaxKind.NumberKeyword:
      return 'Double'
    case ts.SyntaxKind.BooleanKeyword:
      return 'Boolean'
    case ts.SyntaxKind.VoidKeyword:
      return 'Unit'
    case ts.SyntaxKind.AnyKeyword:
      return 'js.Any'
    case ts.SyntaxKind.TypeReference:
      return convertTypeReference(typeNode as ts.TypeReferenceNode)
    case ts.SyntaxKind.LiteralType:
      return convertLiteralType(typeNode as ts.LiteralTypeNode)
    case ts.SyntaxKind.TypeLiteral:
      return 'js.Any' // Object types become js.Any for now
    case ts.SyntaxKind.FunctionType:
      return convertFunctionType(typeNode as ts.FunctionTypeNode)
    default:
      return 'js.Any'
  }
}

function convertLiteralType(node: ts.LiteralTypeNode): string {
  const literal = node.literal
  switch (literal.kind) {
    case ts.SyntaxKind.TrueKeyword:
    case ts.SyntaxKind.FalseKeyword:
      return 'Boolean'
    case ts.SyntaxKind.StringLiteral:
      return 'String'
    case ts.SyntaxKind.NumericLiteral:
      return 'Double'
    default:
      return 'js.Any'
  }
}

function convertTypeReference(node: ts.TypeReferenceNode): string {
  const typeName = node.typeName.getText()
  const typeArgs = node.typeArguments?.map(arg => convertTypeToScala(arg)) || []
  
  if (typeArgs.length > 0) {
    return `${typeName}[${typeArgs.join(', ')}]`
  }
  return typeName
}

function convertFunctionType(node: ts.FunctionTypeNode): string {
  const params = node.parameters.map(p => convertTypeToScala(p.type!))
  const returnType = convertTypeToScala(node.type)
  
  if (params.length === 0) {
    return `js.Function0[${returnType}]`
  } else if (params.length === 1) {
    return `js.Function1[${params[0]}, ${returnType}]`
  } else if (params.length === 2) {
    return `js.Function2[${params[0]}, ${params[1]}, ${returnType}]`
  } else {
    return 'js.Function'
  }
}

function hasExportModifier(node: ts.Node): boolean {
  return node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword) ?? false
}

function generateModuleObject(moduleName: string, exports: {interfaces: ts.InterfaceDeclaration[], types: ts.TypeAliasDeclaration[]}, writer: CodeBlockWriter): void {
  if (exports.types.length === 0) return
  
  writer.newLine()
  const currentIndentLevel = writer.getIndentationLevel()
  writer.setIndentationLevel(0)
  writer.write('@js.native').newLine()
  writer.write(`@JSGlobal("${moduleName}")`).newLine()
  writer.write(`object ${capitalize(moduleName)} extends js.Object `).block(() => {
    exports.types.forEach(typeAlias => {
      const typeName = getTypeAliasName(typeAlias)
      const typeValue = convertTypeAliasToScala(typeAlias)
      writer.writeLine(`type ${typeName} = ${typeValue}`)
    })
  })
  writer.newLine()
  writer.setIndentationLevel(currentIndentLevel)
}

function generateGlobalScopeObject(packageName: string, exports: {interfaces: ts.InterfaceDeclaration[], types: ts.TypeAliasDeclaration[], classes: ts.ClassDeclaration[], functions: ts.FunctionDeclaration[], exportAssignments: ts.ExportAssignment[]}, writer: CodeBlockWriter): void {
  if (exports.types.length === 0 && exports.exportAssignments.length === 0) return
  
  writer.newLine()
  const currentIndentLevel = writer.getIndentationLevel()
  writer.setIndentationLevel(0)
  writer.write('@js.native').newLine()
  writer.write('@JSGlobalScope').newLine()
  writer.write(`object ${capitalize(packageName)} extends js.Object `).block(() => {
    exports.types.forEach(typeAlias => {
      const typeName = getTypeAliasName(typeAlias)
      const typeValue = convertTypeAliasToScala(typeAlias)
      writer.writeLine(`type ${typeName} = ${typeValue}`)
    })
    
    // Handle export assignments by finding the referenced functions
    exports.exportAssignments.forEach(exportAssignment => {
      if (ts.isIdentifier(exportAssignment.expression)) {
        const exportedName = exportAssignment.expression.getText()
        // Find the function with this name
        const exportedFunction = exports.functions.find(func => 
          func.name?.getText() === exportedName
        )
        if (exportedFunction) {
          const functionName = exportedFunction.name!.getText()
          const params = exportedFunction.parameters.map(p => {
            const paramName = p.name.getText()
            const paramType = p.type ? convertTypeToScala(p.type) : 'js.Any'
            return `${paramName}: ${paramType}`
          }).join(', ')
          
          const returnType = exportedFunction.type ? convertTypeToScala(exportedFunction.type) : 'Unit'
          writer.writeLine(`def ${functionName}(${params}): ${returnType} = js.native`)
        }
      }
    })
  })
  writer.newLine()
  writer.setIndentationLevel(currentIndentLevel)
}

function getTypeAliasName(typeAlias: ts.TypeAliasDeclaration): string {
  const name = typeAlias.name.getText()
  const typeParams = typeAlias.typeParameters?.map(tp => tp.name.getText()) || []
  
  if (typeParams.length > 0) {
    return `${name}[${typeParams.join(', ')}]`
  }
  return name
}

function convertTypeAliasToScala(typeAlias: ts.TypeAliasDeclaration): string {
  return convertTypeToScala(typeAlias.type)
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function processExportAssignment(node: ts.ExportAssignment, writer: CodeBlockWriter, namespace: string): void {
  // Export assignments are handled in the global scope object generation
  // No direct processing needed here
}

function processInterfaceMembersWithDeduplication(members: readonly ts.TypeElement[], writer: CodeBlockWriter): void {
  const processedSignatures = new Set<string>()
  
  members.forEach(member => {
    if (ts.isMethodSignature(member)) {
      const name = member.name.getText()
      const params = member.parameters.map(p => {
        const paramName = p.name.getText()
        const paramType = p.type ? convertTypeToScala(p.type) : 'js.Any'
        return `${paramName}: ${paramType}`
      }).join(', ')
      
      const returnType = member.type ? convertTypeToScala(member.type) : 'Unit'
      const signature = `def ${name}(${params}): ${returnType} = js.native`
      
      if (!processedSignatures.has(signature)) {
        processedSignatures.add(signature)
        writer.writeLine(signature)
      }
    } else {
      processInterfaceMember(member, writer)
    }
  })
}