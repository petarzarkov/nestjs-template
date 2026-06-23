/**
 * oxlint JS plugin enforcing this project's TypeORM column/constraint
 * conventions. Ported from the former Biome GritQL plugins that lived in
 * `plugins/*.grit`:
 *   - typeorm-explicit-naming.grit -> `typeorm/explicit-naming`
 *   - typeorm-timestamptz.grit     -> `typeorm/timestamptz`
 *   - typeorm-column-length.grit   -> `typeorm/column-length`
 *
 * The rules match decorator call expressions by identifier name (e.g. the
 * `Column(...)` call inside `@Column(...)`), mirroring the syntactic matching
 * the GritQL patterns did. See CLAUDE.md "DB Constraint Naming Convention".
 */

// ---------------------------------------------------------------------------
// AST helpers (ESTree-compatible nodes, as exposed to oxlint JS plugins)
// ---------------------------------------------------------------------------

/** The callee identifier name if `node` is a plain `Name(...)` call. */
function calleeName(node) {
  return node.callee && node.callee.type === 'Identifier'
    ? node.callee.name
    : undefined;
}

/** True when `node` is a string literal (optionally equal to `value`). */
function isStringLiteral(node, value) {
  if (!node || node.type !== 'Literal' || typeof node.value !== 'string') {
    return false;
  }
  return value === undefined ? true : node.value === value;
}

/** First argument that is an object expression, or undefined. */
function objectArg(node) {
  return node.arguments.find(arg => arg.type === 'ObjectExpression');
}

/** Find an object property by key name (handles identifier and string keys). */
function getProperty(objExpr, name) {
  if (!objExpr) {
    return undefined;
  }
  return objExpr.properties.find(prop => {
    if (prop.type !== 'Property') {
      return false;
    }
    if (prop.key.type === 'Identifier') {
      return prop.key.name === name;
    }
    if (prop.key.type === 'Literal') {
      return prop.key.value === name;
    }
    return false;
  });
}

/** Whether `objExpr` declares a property called `name`. */
function hasProperty(objExpr, name) {
  return getProperty(objExpr, name) !== undefined;
}

/** Whether `objExpr` declares `name: '<value>'`. */
function hasStringProperty(objExpr, name, value) {
  const prop = getProperty(objExpr, name);
  return prop !== undefined && isStringLiteral(prop.value, value);
}

/** Whether `objExpr` declares `name: true`. */
function hasTrueProperty(objExpr, name) {
  const prop = getProperty(objExpr, name);
  return (
    prop !== undefined &&
    prop.value.type === 'Literal' &&
    prop.value.value === true
  );
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

/** @type {import('@typescript-eslint/utils').TSESLint.RuleModule<string>} */
const explicitNaming = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require explicit names for TypeORM indexes, foreign keys, primary keys and enums',
    },
    messages: {
      index:
        "@Index() must have an explicit name as the first argument, e.g. @Index('my_column_index')",
      joinColumn:
        "@JoinColumn() must include foreignKeyConstraintName, e.g. @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_source_to_target' })",
      primaryKey:
        "@PrimaryGeneratedColumn() must include primaryKeyConstraintName, e.g. @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_my_db_entity' })",
      enumName:
        "@Column({ type: 'enum' }) must include enumName, e.g. @Column({ type: 'enum', enum: MyEnum, enumName: 'my_enum_name' })",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        switch (calleeName(node)) {
          case 'Index':
            if (!isStringLiteral(node.arguments[0])) {
              context.report({ node, messageId: 'index' });
            }
            break;
          case 'JoinColumn': {
            const obj = objectArg(node);
            if (!obj || !hasProperty(obj, 'foreignKeyConstraintName')) {
              context.report({ node, messageId: 'joinColumn' });
            }
            break;
          }
          case 'PrimaryGeneratedColumn': {
            const obj = objectArg(node);
            if (!obj || !hasProperty(obj, 'primaryKeyConstraintName')) {
              context.report({ node, messageId: 'primaryKey' });
            }
            break;
          }
          case 'Column': {
            const obj = objectArg(node);
            if (
              obj &&
              hasStringProperty(obj, 'type', 'enum') &&
              !hasProperty(obj, 'enumName')
            ) {
              context.report({ node, messageId: 'enumName' });
            }
            break;
          }
          default:
            break;
        }
      },
    };
  },
};

/** @type {import('@typescript-eslint/utils').TSESLint.RuleModule<string>} */
const timestamptz = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require timestamptz for TypeORM date columns to store timezone information',
    },
    messages: {
      createDate:
        "@CreateDateColumn() must include type: 'timestamptz' to store dates with timezone",
      updateDate:
        "@UpdateDateColumn() must include type: 'timestamptz' to store dates with timezone",
      deleteDate:
        "@DeleteDateColumn() must include type: 'timestamptz' to store dates with timezone",
      column:
        "@Column({ type: 'timestamp' }) should be type: 'timestamptz' to store dates with timezone",
    },
    schema: [],
  },
  create(context) {
    const dateColumns = {
      CreateDateColumn: 'createDate',
      UpdateDateColumn: 'updateDate',
      DeleteDateColumn: 'deleteDate',
    };
    return {
      CallExpression(node) {
        const name = calleeName(node);
        if (name && Object.hasOwn(dateColumns, name)) {
          const obj = objectArg(node);
          if (!obj || !hasStringProperty(obj, 'type', 'timestamptz')) {
            context.report({ node, messageId: dateColumns[name] });
          }
        } else if (name === 'Column') {
          const obj = objectArg(node);
          if (obj && hasStringProperty(obj, 'type', 'timestamp')) {
            context.report({ node, messageId: 'column' });
          }
        }
      },
    };
  },
};

/** @type {import('@typescript-eslint/utils').TSESLint.RuleModule<string>} */
const columnLength = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require explicit length for TypeORM varchar columns and forbid unbounded text',
    },
    messages: {
      varcharLength:
        "@Column({ type: 'varchar' }) must include length, e.g. @Column({ type: 'varchar', length: 255 })",
      noArgs:
        "@Column() with no arguments defaults to varchar without a length constraint. Specify type and length, e.g. @Column({ type: 'varchar', length: 255 })",
      uniqueLength:
        '@Column({ unique: true }) must include length, e.g. @Column({ unique: true, length: 255 })',
      noText:
        "@Column({ type: 'text' }) is not allowed. Use type: 'varchar' with an explicit length, e.g. @Column({ type: 'varchar', length: 255 })",
      positionalText:
        "@Column('text') is not allowed. Use type: 'varchar' with an explicit length, e.g. @Column({ type: 'varchar', length: 255 })",
      positionalVarchar:
        "@Column('varchar') must include length, e.g. @Column({ type: 'varchar', length: 255 })",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (calleeName(node) !== 'Column') {
          return;
        }
        const args = node.arguments;
        // @Column()
        if (args.length === 0) {
          context.report({ node, messageId: 'noArgs' });
          return;
        }
        // Positional type form: @Column('text'), @Column('varchar', { ... })
        if (isStringLiteral(args[0])) {
          if (args[0].value === 'text') {
            context.report({ node, messageId: 'positionalText' });
            return;
          }
          if (args[0].value === 'varchar') {
            const opts = objectArg(node);
            if (!opts || !hasProperty(opts, 'length')) {
              context.report({ node, messageId: 'positionalVarchar' });
            }
          }
          return;
        }
        // Object form: @Column({ ... })
        const obj = objectArg(node);
        if (!obj) {
          return;
        }
        if (hasStringProperty(obj, 'type', 'text')) {
          context.report({ node, messageId: 'noText' });
        } else if (
          hasStringProperty(obj, 'type', 'varchar') &&
          !hasProperty(obj, 'length')
        ) {
          context.report({ node, messageId: 'varcharLength' });
        } else if (
          hasTrueProperty(obj, 'unique') &&
          !hasProperty(obj, 'length')
        ) {
          context.report({ node, messageId: 'uniqueLength' });
        }
      },
    };
  },
};

export default {
  meta: { name: 'typeorm' },
  rules: {
    'explicit-naming': explicitNaming,
    timestamptz,
    'column-length': columnLength,
  },
};
