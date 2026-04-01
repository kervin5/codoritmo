const { Interpreter } = require('./src/engine');

async function test() {
  const code = `Proceso HolaMundo
    Escribir "Hola Mundo!"
FinProceso`;

  console.log('Testing code:');
  console.log(code);
  console.log('\n---\n');

  const result = await new Interpreter().run(code);

  console.log('Result:', result);
  console.log('Output:', result.output);
}

test().catch(console.error);