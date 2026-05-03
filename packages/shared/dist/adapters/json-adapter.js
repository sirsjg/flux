import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
const defaultData = {
    projects: [],
    epics: [],
    tasks: [],
};
export function createJsonAdapter(filePath) {
    let data = { ...defaultData };
    return {
        get data() {
            return data;
        },
        read() {
            if (existsSync(filePath)) {
                try {
                    const content = readFileSync(filePath, 'utf-8');
                    data = JSON.parse(content);
                }
                catch {
                    data = { ...defaultData };
                }
            }
            else {
                data = { ...defaultData };
                this.write();
            }
        },
        write() {
            const dir = dirname(filePath);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            writeFileSync(filePath, JSON.stringify(data, null, 2));
        },
    };
}
