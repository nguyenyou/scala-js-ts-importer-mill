import * as ts from 'typescript'
import CodeBlockWriter from 'code-block-writer'

// Shared Scala reserved words list
const SCALA_RESERVED_WORDS = ['abstract', 'case', 'catch', 'class', 'def', 'do', 'else', 'extends', 'false', 'final', 'finally', 'for', 'forSome', 'if', 'implicit', 'import', 'lazy', 'macro', 'match', 'new', 'null', 'object', 'override', 'package', 'private', 'protected', 'return', 'sealed', 'super', 'then', 'this', 'throw', 'trait', 'try', 'true', 'type', 'val', 'var', 'while', 'with', 'yield']

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
    newLine: '\n',
    useTabs: false
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
  // Use shared SCALA_RESERVED_WORDS constant
  const packageDeclaration = packageName.includes('-') || !packageName.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/) || SCALA_RESERVED_WORDS.includes(packageName)
    ? `package \`${packageName}\`` 
    : `package ${packageName}`
    
  writer.write(`${packageDeclaration} `).block(() => {
    // Collect top-level exports for global scope object
    const topLevelExports: {interfaces: ts.InterfaceDeclaration[], types: ts.TypeAliasDeclaration[], classes: ts.ClassDeclaration[], functions: ts.FunctionDeclaration[], exportAssignments: ts.ExportAssignment[], variables: ts.VariableDeclaration[]} = {
      interfaces: [],
      types: [],
      classes: [],
      functions: [],
      exportAssignments: [],
      variables: []
    }
    
    // Process top-level declarations and collect exports
    sourceFile.statements.forEach(statement => {
      if (hasExportModifier(statement)) {
        if (ts.isInterfaceDeclaration(statement)) {
          topLevelExports.interfaces.push(statement)
        } else if (ts.isClassDeclaration(statement)) {
          topLevelExports.classes.push(statement)
        }
      }
      
      // Collect functions, export assignments, variable declarations, and ALL type aliases
      if (ts.isFunctionDeclaration(statement)) {
        topLevelExports.functions.push(statement)
      } else if (ts.isExportAssignment(statement)) {
        topLevelExports.exportAssignments.push(statement)
      } else if (ts.isVariableStatement(statement)) {
        // Collect variable declarations that should go in global scope
        statement.declarationList.declarations.forEach(decl => {
          if (decl.type && !ts.isTypeLiteralNode(decl.type)) {
            topLevelExports.variables.push(decl)
          }
        })
      } else if (ts.isTypeAliasDeclaration(statement)) {
        // Collect ALL type aliases for global scope object (both exported and non-exported)
        topLevelExports.types.push(statement)
      }
      
      processStatement(statement, writer, '')
    })
    
    // Generate global scope object if there are top-level exports, export assignments, or variables
    if (topLevelExports.types.length > 0 || topLevelExports.exportAssignments.length > 0 || topLevelExports.variables.length > 0) {
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
    case ts.SyntaxKind.ImportDeclaration:
      // Skip import declarations - they're just references
      break
    default:
      // Skip unhandled statement types
      break
  }
}

function processModuleDeclaration(node: ts.ModuleDeclaration, writer: CodeBlockWriter, namespace: string): void {
  const moduleName = node.name.getText()
  const newNamespace = namespace ? `${namespace}.${moduleName}` : moduleName
  
  // Handle reserved words for module names
  // Use shared SCALA_RESERVED_WORDS constant
  const safeModuleName = SCALA_RESERVED_WORDS.includes(moduleName) ? `\`${moduleName}\`` : moduleName
  
  writer.newLine()
  const currentIndentLevel = writer.getIndentationLevel()
  writer.setIndentationLevel(0)
  writer.write(`package ${safeModuleName} `).block(() => {
    
    if (node.body && ts.isModuleBlock(node.body)) {
      // Collect exports for module object
      const exports: {interfaces: ts.InterfaceDeclaration[], types: ts.TypeAliasDeclaration[], functions: ts.FunctionDeclaration[]} = {
        interfaces: [],
        types: [],
        functions: []
      }
      
      // Process declarations and collect exports
      node.body.statements.forEach(statement => {
        // In declare module blocks, all top-level declarations are implicitly exported
        // So we collect all functions, types, etc., not just ones with explicit export modifier
        if (ts.isInterfaceDeclaration(statement)) {
          exports.interfaces.push(statement)
        } else if (ts.isTypeAliasDeclaration(statement)) {
          exports.types.push(statement)
        } else if (ts.isFunctionDeclaration(statement)) {
          exports.functions.push(statement)
        }
        processStatement(statement, writer, newNamespace)
      })
      
      // Generate module object if there are exports
      if (exports.types.length > 0 || exports.functions.length > 0) {
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
  
  // Handle reserved words for class names
  // Use shared SCALA_RESERVED_WORDS constant
  const safeClassName = SCALA_RESERVED_WORDS.includes(className) ? `\`${className}\`` : className
  
  // Handle type parameters
  const typeParams = node.typeParameters?.map(tp => {
    const paramName = tp.name.getText()
    const constraint = tp.constraint ? ` <: ${convertTypeToScala(tp.constraint)}` : ''
    return `${paramName}${constraint}`
  }) || []
  
  const typeParamString = typeParams.length > 0 ? `[${typeParams.join(', ')}]` : ''
  
  writer.newLine()
  const currentIndentLevel = writer.getIndentationLevel()
  writer.setIndentationLevel(0)
  writer.write('@js.native').newLine()
  
  // @JSGlobal logic:
  // - All classes in namespaces: @JSGlobal("namespace.ClassName") 
  // - Top-level classes: @JSGlobal (no parameter)
  if (namespace) {
    writer.write(`@JSGlobal("${namespace}.${className}")`).newLine()
  } else {
    writer.write('@JSGlobal').newLine()
  }
  
  writer.write(`${isAbstract ? 'abstract ' : ''}class ${safeClassName}${typeParamString} extends js.Object `).block(() => {
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
  
  // Handle type parameters
  const typeParams = node.typeParameters?.map(tp => {
    const paramName = tp.name.getText()
    const constraint = tp.constraint ? ` <: ${convertTypeToScala(tp.constraint)}` : ''
    return `${paramName}${constraint}`
  }) || []
  
  const typeParamString = typeParams.length > 0 ? `[${typeParams.join(', ')}]` : ''
  
  // For exported interfaces in modules, no @JSGlobal annotation
  if (isExport) {
    writer.newLine()
    const currentIndentLevel = writer.getIndentationLevel()
    writer.setIndentationLevel(0)
    writer.write('@js.native').newLine()
    writer.write(`trait ${interfaceName}${typeParamString} extends js.Object `).block(() => {
      processInterfaceMembersWithDeduplication(node.members, writer)
    })
    writer.newLine()
    writer.setIndentationLevel(currentIndentLevel)
    return
  }
  
  // Non-exported interfaces at top level should not have @JSGlobal
  writer.newLine()
  const currentIndentLevel = writer.getIndentationLevel()
  writer.setIndentationLevel(0)
  writer.write('@js.native').newLine()
  // Don't add @JSGlobal for top-level interfaces
  writer.write(`trait ${interfaceName}${typeParamString} extends js.Object `).block(() => {
    processInterfaceMembersWithDeduplication(node.members, writer)
  })
  writer.newLine()
  writer.setIndentationLevel(currentIndentLevel)
}

function processClassMember(member: ts.ClassElement, writer: CodeBlockWriter, isAbstractClass?: boolean): void {
  switch (member.kind) {
    case ts.SyntaxKind.PropertyDeclaration:
      processPropertyDeclaration(member as ts.PropertyDeclaration, writer, isAbstractClass)
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
    case ts.SyntaxKind.IndexSignature:
      processIndexSignature(member as ts.IndexSignatureDeclaration, writer)
      break
  }
}

function processPropertyDeclaration(node: ts.PropertyDeclaration, writer: CodeBlockWriter, isAbstractClass?: boolean): void {
  const name = node.name.getText()
  const typeText = node.type ? convertTypeToScala(node.type) : 'js.Any'
  
  // Class properties don't need = js.native implementation for abstract classes
  const implementation = isAbstractClass ? '' : ' = js.native'
  writer.writeLine(`var ${name}: ${typeText}${implementation}`)
}

function processPropertySignature(node: ts.PropertySignature, writer: CodeBlockWriter): void {
  const name = node.name.getText()
  const typeText = node.type ? convertTypeToScala(node.type) : 'js.Any'
  writer.writeLine(`var ${name}: ${typeText} = js.native`)
}

function processMethodDeclaration(node: ts.MethodDeclaration, writer: CodeBlockWriter, isAbstractClass?: boolean): void {
  const name = node.name.getText()
  
  // Handle reserved words
  // Use shared SCALA_RESERVED_WORDS constant
  const safeName = SCALA_RESERVED_WORDS.includes(name) ? `\`${name}\`` : name
  
  // Handle method type parameters
  const typeParams = node.typeParameters?.map(tp => {
    const paramName = tp.name.getText()
    const constraint = tp.constraint ? ` <: ${convertTypeToScala(tp.constraint)}` : ''
    return `${paramName}${constraint}`
  }) || []
  
  const typeParamString = typeParams.length > 0 ? `[${typeParams.join(', ')}]` : ''
  
  const params = node.parameters.map(p => {
    const paramName = p.name.getText()
    let paramType = p.type ? convertTypeToScala(p.type) : 'js.Any'
    
    // Handle rest parameters
    if (p.dotDotDotToken) {
      paramType = paramType.replace(/^js\.Array\[(.+)\]$/, '$1')
      return `${paramName}: ${paramType}*`
    }
    
    // Handle optional parameters
    const optional = p.questionToken ? ' = ???' : ''
    return `${paramName}: ${paramType}${optional}`
  }).join(', ')
  
  const returnType = node.type ? convertTypeToScala(node.type) : 'Unit'
  
  // Abstract class methods don't have implementations
  const implementation = isAbstractClass ? '' : ' = js.native'
  writer.writeLine(`def ${safeName}${typeParamString}(${params}): ${returnType}${implementation}`)
}

function processMethodSignature(node: ts.MethodSignature, writer: CodeBlockWriter): void {
  const name = node.name.getText()
  
  // Handle reserved words
  // Use shared SCALA_RESERVED_WORDS constant
  const safeName = SCALA_RESERVED_WORDS.includes(name) ? `\`${name}\`` : name
  
  // Handle method type parameters
  const typeParams = node.typeParameters?.map(tp => {
    const paramName = tp.name.getText()
    const constraint = tp.constraint ? ` <: ${convertTypeToScala(tp.constraint)}` : ''
    return `${paramName}${constraint}`
  }) || []
  
  const typeParamString = typeParams.length > 0 ? `[${typeParams.join(', ')}]` : ''
  
  const params = node.parameters.map(p => {
    const paramName = p.name.getText()
    let paramType = p.type ? convertTypeToScala(p.type) : 'js.Any'
    
    // Handle reserved words for parameter names
    const safeParamName = SCALA_RESERVED_WORDS.includes(paramName) ? `\`${paramName}\`` : paramName
    
    // Handle rest parameters
    if (p.dotDotDotToken) {
      paramType = paramType.replace(/^js\.Array\[(.+)\]$/, '$1')
      return `${safeParamName}: ${paramType}*`
    }
    
    // Handle optional parameters
    const optional = p.questionToken ? ' = ???' : ''
    return `${safeParamName}: ${paramType}${optional}`
  }).join(', ')
  
  const returnType = node.type ? convertTypeToScala(node.type) : 'js.Dynamic'
  writer.writeLine(`def ${safeName}${typeParamString}(${params}): ${returnType} = js.native`)
}

function processIndexSignature(node: ts.IndexSignatureDeclaration, writer: CodeBlockWriter): void {
  const parameter = node.parameters[0]
  const indexType = parameter.type ? convertTypeToScala(parameter.type) : 'js.Any'
  const returnType = node.type ? convertTypeToScala(node.type) : 'js.Any'
  const paramName = parameter.name.getText()
  
  // Generate apply method for reading
  writer.writeLine('@JSBracketAccess')
  writer.writeLine(`def apply(${paramName}: ${indexType}): ${returnType} = js.native`)
  
  // Generate update method for writing (only if not readonly)
  const isReadonly = node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ReadonlyKeyword)
  if (!isReadonly) {
    writer.writeLine('@JSBracketAccess')
    writer.writeLine(`def update(${paramName}: ${indexType}, v: ${returnType}): Unit = js.native`)
  }
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
  // All type aliases are deferred to either module objects (for namespaces) 
  // or global scope objects (for top level). Don't process them immediately.
  return
}

function processVariableStatement(node: ts.VariableStatement, writer: CodeBlockWriter, namespace: string): void {
  node.declarationList.declarations.forEach(decl => {
    const varName = decl.name.getText()
    
    if (decl.type && ts.isTypeLiteralNode(decl.type)) {
      // Convert object literal type to Scala object
      writer.newLine()
      const currentIndentLevel = writer.getIndentationLevel()
      writer.setIndentationLevel(0)
      writer.write('@js.native').newLine()
      writer.write('@JSGlobal').newLine()
      writer.write(`object ${varName} extends js.Object `).block(() => {
        (decl.type as ts.TypeLiteralNode).members.forEach((member: ts.TypeElement) => {
          if (ts.isPropertySignature(member)) {
            const memberName = member.name?.getText() || 'unknown'
            const memberType = member.type ? convertTypeToScala(member.type) : 'js.Any'
            
            // Handle numeric keys by wrapping in backticks
            const safeMemberName = /^[0-9]/.test(memberName) || memberName.includes('.') 
              ? `\`${memberName}\`` 
              : memberName
            
            writer.writeLine(`var ${safeMemberName}: ${memberType} = js.native`)
          }
        })
      })
      writer.newLine()
      writer.setIndentationLevel(currentIndentLevel)
    } else {
      // Handle other variable types
      const varType = decl.type ? convertTypeToScala(decl.type) : 'js.Any'
      // Variables go into global scope object - we'll collect them for later processing
    }
  })
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
    case ts.SyntaxKind.ObjectKeyword:
      return 'js.Object'
    case ts.SyntaxKind.NeverKeyword:
      return 'Nothing'
    case ts.SyntaxKind.ThisKeyword:
    case ts.SyntaxKind.ThisType:
      return 'this.type'
    case ts.SyntaxKind.TypeReference:
      return convertTypeReference(typeNode as ts.TypeReferenceNode)
    case ts.SyntaxKind.LiteralType:
      return convertLiteralType(typeNode as ts.LiteralTypeNode)
    case ts.SyntaxKind.TypeLiteral:
      return 'js.Any' // Object types become js.Any for now
    case ts.SyntaxKind.FunctionType:
      return convertFunctionType(typeNode as ts.FunctionTypeNode)
    case ts.SyntaxKind.ParenthesizedType:
      return convertTypeToScala((typeNode as ts.ParenthesizedTypeNode).type)
    case ts.SyntaxKind.ArrayType:
      return convertArrayType(typeNode as ts.ArrayTypeNode)
    case ts.SyntaxKind.UnionType:
      return convertUnionType(typeNode as ts.UnionTypeNode)
    case ts.SyntaxKind.IntersectionType:
      return convertIntersectionType(typeNode as ts.IntersectionTypeNode)
    case ts.SyntaxKind.TypeOperator:
      return convertTypeOperator(typeNode as ts.TypeOperatorNode)
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
      const text = literal.getText()
      return text.includes('.') ? 'Double' : 'Int'
    default:
      return 'js.Any'
  }
}

function convertTypeReference(node: ts.TypeReferenceNode): string {
  const typeName = node.typeName.getText()
  const typeArgs = node.typeArguments?.map(arg => convertTypeToScala(arg)) || []
  
  // Handle special type mappings
  if (typeName === 'Array' && typeArgs.length > 0) {
    return `js.Array[${typeArgs.join(', ')}]`
  }
  
  if (typeName === 'ReadonlyArray' && typeArgs.length > 0) {
    return `js.Array[_ <: ${typeArgs.join(', ')}]`
  }
  
  // Map common TypeScript types to Scala.js equivalents
  const typeMapping: Record<string, string> = {
    'null': 'Null',
    'undefined': 'Unit',
    'Float32Array': 'js.typedarray.Float32Array',
    'Float64Array': 'js.typedarray.Float64Array',
    'Uint8Array': 'js.typedarray.Uint8Array',
    'Uint16Array': 'js.typedarray.Uint16Array',
    'Uint32Array': 'js.typedarray.Uint32Array',
    'Int8Array': 'js.typedarray.Int8Array',
    'Int16Array': 'js.typedarray.Int16Array',
    'Int32Array': 'js.typedarray.Int32Array',
    'Uint8ClampedArray': 'js.typedarray.Uint8ClampedArray',
    'ArrayBuffer': 'js.typedarray.ArrayBuffer',
    'ArrayBufferView': 'js.typedarray.ArrayBufferView',
    'DataView': 'js.typedarray.DataView',
    'ReadonlyArray': 'js.Array',
    'PromiseLike': 'js.Thenable'
  }
  
  if (typeMapping[typeName]) {
    if (typeArgs.length > 0) {
      return `${typeMapping[typeName]}[${typeArgs.join(', ')}]`
    }
    return typeMapping[typeName]
  }
  
  if (typeArgs.length > 0) {
    return `${typeName}[${typeArgs.join(', ')}]`
  }
  return typeName
}

function convertFunctionType(node: ts.FunctionTypeNode): string {
  const params = node.parameters.map(p => p.type ? convertTypeToScala(p.type) : 'js.Any')
  const returnType = node.type ? convertTypeToScala(node.type) : 'Unit'
  
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

function convertArrayType(node: ts.ArrayTypeNode): string {
  const elementType = convertTypeToScala(node.elementType)
  return `js.Array[${elementType}]`
}

function convertUnionType(node: ts.UnionTypeNode): string {
  const types = node.types.map(t => convertTypeToScala(t))
  
  // Check if all types are string literals - if so, simplify to String
  const allStringLiterals = node.types.every(t => 
    ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)
  )
  
  if (allStringLiterals) {
    return 'String'
  }
  
  // Check if all types are numeric literals of the same category
  const allNumericLiterals = node.types.every(t => 
    ts.isLiteralTypeNode(t) && ts.isNumericLiteral(t.literal)
  )
  
  if (allNumericLiterals) {
    // Check if all are integers or all are doubles
    const allIntegers = node.types.every(t => {
      if (ts.isLiteralTypeNode(t) && ts.isNumericLiteral(t.literal)) {
        const text = t.literal.getText()
        return !text.includes('.')
      }
      return false
    })
    
    const allDoubles = node.types.every(t => {
      if (ts.isLiteralTypeNode(t) && ts.isNumericLiteral(t.literal)) {
        const text = t.literal.getText()
        return text.includes('.')
      }
      return false
    })
    
    if (allIntegers) {
      return 'Int'
    } else if (allDoubles) {
      return 'Double'
    }
  }
  
  // Remove duplicates and join with |
  const uniqueTypes = [...new Set(types)]
  
  // Handle common nullable patterns: T | Null | Unit becomes T | js.Any
  if (uniqueTypes.includes('Null') && uniqueTypes.includes('Unit')) {
    const otherTypes = uniqueTypes.filter(t => t !== 'Null' && t !== 'Unit')
    if (otherTypes.length === 1) {
      return `${otherTypes[0]} | js.Any`
    } else if (otherTypes.length > 1) {
      return `${otherTypes.join(' | ')} | js.Any`
    }
  }
  
  // If we have multiple string literals plus other types, simplify string literals to String
  const hasStringLiterals = node.types.some(t => 
    ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)
  )
  const hasNonStringLiterals = node.types.some(t => 
    !(ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal))
  )
  
  if (hasStringLiterals && hasNonStringLiterals) {
    // Replace all string literal types with a single "String"
    const nonStringLiteralTypes = node.types
      .filter(t => !(ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)))
      .map(t => convertTypeToScala(t))
    
    return ['String', ...nonStringLiteralTypes].join(' | ')
  }
  
  return uniqueTypes.join(' | ')
}

function convertIntersectionType(node: ts.IntersectionTypeNode): string {
  const types = node.types.map(t => convertTypeToScala(t))
  
  // Remove duplicates but preserve order
  const uniqueTypes = []
  const seen = new Set()
  for (const type of types) {
    if (!seen.has(type)) {
      seen.add(type)
      uniqueTypes.push(type)
    }
  }
  
  return uniqueTypes.join(' with ')
}

function convertTypeOperator(node: ts.TypeOperatorNode): string {
  if (node.operator === ts.SyntaxKind.KeyOfKeyword) {
    // keyof T becomes String in most cases, as we can't replicate exact keyof semantics
    return 'String'
  }
  return 'js.Any'
}

function hasExportModifier(node: ts.Node): boolean {
  return (node as any).modifiers?.some((mod: ts.Modifier) => mod.kind === ts.SyntaxKind.ExportKeyword) ?? false
}

function generateModuleObject(moduleName: string, exports: {interfaces: ts.InterfaceDeclaration[], types: ts.TypeAliasDeclaration[], functions: ts.FunctionDeclaration[]}, writer: CodeBlockWriter): void {
  if (exports.types.length === 0 && exports.functions.length === 0) return
  
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
    
    exports.functions.forEach(func => {
      const functionName = func.name!.getText()
      
      // Handle function type parameters
      const typeParams = func.typeParameters?.map(tp => {
        const paramName = tp.name.getText()
        const constraint = tp.constraint ? ` <: ${convertTypeToScala(tp.constraint)}` : ''
        return `${paramName}${constraint}`
      }) || []
      
      const typeParamString = typeParams.length > 0 ? `[${typeParams.join(', ')}]` : ''
      
      const params = func.parameters.map(p => {
        const paramName = p.name.getText()
        const paramType = p.type ? convertTypeToScala(p.type) : 'js.Any'
        return `${paramName}: ${paramType}`
      }).join(', ')
      
      const returnType = func.type ? convertTypeToScala(func.type) : 'js.Dynamic'
      writer.writeLine(`def ${functionName}${typeParamString}(${params}): ${returnType} = js.native`)
    })
  })
  writer.newLine()
  writer.setIndentationLevel(currentIndentLevel)
}

function generateGlobalScopeObject(packageName: string, exports: {interfaces: ts.InterfaceDeclaration[], types: ts.TypeAliasDeclaration[], classes: ts.ClassDeclaration[], functions: ts.FunctionDeclaration[], exportAssignments: ts.ExportAssignment[], variables: ts.VariableDeclaration[]}, writer: CodeBlockWriter): void {
  if (exports.types.length === 0 && exports.exportAssignments.length === 0 && exports.variables.length === 0) return
  
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
    
    // Handle variable declarations
    exports.variables.forEach(variable => {
      const varName = variable.name.getText()
      const varType = variable.type ? convertTypeToScala(variable.type) : 'js.Any'
      writer.writeLine(`val ${varName}: ${varType} = js.native`)
    })
  })
  writer.newLine()
  writer.setIndentationLevel(currentIndentLevel)
}

function getTypeAliasName(typeAlias: ts.TypeAliasDeclaration): string {
  const name = typeAlias.name.getText()
  const typeParams = typeAlias.typeParameters?.map(tp => {
    const paramName = tp.name.getText()
    const constraint = tp.constraint ? ` <: ${convertTypeToScala(tp.constraint)}` : ''
    return `${paramName}${constraint}`
  }) || []
  
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