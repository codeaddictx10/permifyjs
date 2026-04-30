import chalk from 'chalk';

export const logger = {
  info: (msg: string) => console.log(chalk.cyan('ℹ'), msg),
  success: (msg: string) => console.log(chalk.green('✔'), msg),
  error: (msg: string) => console.log(chalk.red('✖'), msg),
  warn: (msg: string) => console.log(chalk.yellow('⚠'), msg),
  step: (msg: string) => console.log(chalk.blue('→'), msg),
  blank: () => console.log(),
  title: (msg: string) => console.log(chalk.bold.white(msg)),
};
