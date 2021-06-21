import Server from './server';
import fs  from 'fs';

const port = parseInt(process.env.PORT ?? '5111');
const mockPath = process.env.MOCK_PATH ?? '/mock';

const seedPath = process.env.SEED ?? '/data/seed.json';
let seed: any;
try {
    seed = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
} catch (err) {
    console.warn(`Unable to seed: ${err.message}`);
}

new Server(mockPath, seed).listen(port);
