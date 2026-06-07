import readline from 'readline';
import { createUser } from '../services/auth-service.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  const username = await ask('Kullanıcı adı: ');
  const password = await ask('Şifre: ');
  const displayName = await ask('Görünen ad: ');
  const isAdminAnswer = await ask('Yönetici mi? (e/h): ');

  const user = await createUser({
    username: username.trim(),
    password: password.trim(),
    displayName: displayName.trim(),
    isAdmin: isAdminAnswer.trim().toLowerCase() === 'e',
  });

  console.log('Kullanıcı oluşturuldu:', user);
  rl.close();
}

main().catch((err) => {
  console.error(err);
  rl.close();
  process.exit(1);
});
