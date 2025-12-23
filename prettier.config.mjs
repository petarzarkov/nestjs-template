/**
 * @type {import('prettier').Config}
 */
const config = {
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  bracketSpacing: true,
  arrowParens: 'avoid',
  endOfLine: 'lf',
  jsxSingleQuote: false,
  bracketSameLine: false,
  overrides: [
    {
      files: '**/migrations/**/*.ts',
      options: {
        embeddedSqlTags: ['sql', 'postgresql'],
        language: 'postgresql',
        keywordCase: 'upper',
        plugins: ['prettier-plugin-embed', 'prettier-plugin-sql'],
      },
    },
  ],
};

export default config;
