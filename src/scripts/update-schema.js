"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var supabase_js_1 = require("@supabase/supabase-js");
var fs_1 = require("fs");
var path_1 = require("path");
// Read and parse .env file
function loadEnv() {
    try {
        var envPath = path_1.default.resolve(process.cwd(), '.env');
        console.log('Loading env file from:', envPath);
        var envContent = fs_1.default.readFileSync(envPath, 'utf-8');
        var env_1 = {};
        envContent.split('\n').forEach(function (line) {
            var _a = line.split('='), key = _a[0], valueParts = _a.slice(1);
            if (key && valueParts.length > 0) {
                env_1[key.trim()] = valueParts.join('=').trim();
            }
        });
        return env_1;
    }
    catch (error) {
        console.error('Error loading .env file:', error);
        throw error;
    }
}
function updateSchema() {
    return __awaiter(this, void 0, void 0, function () {
        var env, supabaseUrl, supabaseKey, supabase, createError, createTableError, columnCheckError, alterError, directAlterError, workcentersCheckError, createError_1, sqlError, ncrsCheckError, sqlError, error_1;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 21, , 22]);
                    console.log('Loading environment variables...');
                    env = loadEnv();
                    supabaseUrl = env.VITE_SUPABASE_URL;
                    supabaseKey = env.VITE_SUPABASE_ANON_KEY;
                    if (!supabaseUrl || !supabaseKey) {
                        throw new Error('Missing Supabase environment variables');
                    }
                    console.log('Connecting to Supabase:', supabaseUrl);
                    supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
                    // Create shipmentlogs table
                    console.log('Creating shipmentlogs table...');
                    return [4 /*yield*/, supabase
                            .from('shipmentlogs')
                            .select('*')
                            .limit(1)];
                case 1:
                    createError = (_e.sent()).error;
                    if (!((_a = createError === null || createError === void 0 ? void 0 : createError.message) === null || _a === void 0 ? void 0 : _a.includes('does not exist'))) return [3 /*break*/, 3];
                    return [4 /*yield*/, supabase.schema.sql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n                CREATE TABLE IF NOT EXISTS public.shipmentlogs (\n                    id SERIAL PRIMARY KEY,\n                    job_number TEXT NOT NULL,\n                    status TEXT NOT NULL CHECK (status IN ('Pending', 'Shipped', 'Delivered')),\n                    date TIMESTAMP WITH TIME ZONE NOT NULL,\n                    description TEXT NOT NULL,\n                    vendor TEXT,\n                    shipment_date TIMESTAMP WITH TIME ZONE,\n                    severity TEXT CHECK (severity IN ('Normal', 'High', 'Critical')),\n                    tracking_number TEXT,\n                    carrier TEXT,\n                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,\n                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP\n                );\n            "], ["\n                CREATE TABLE IF NOT EXISTS public.shipmentlogs (\n                    id SERIAL PRIMARY KEY,\n                    job_number TEXT NOT NULL,\n                    status TEXT NOT NULL CHECK (status IN ('Pending', 'Shipped', 'Delivered')),\n                    date TIMESTAMP WITH TIME ZONE NOT NULL,\n                    description TEXT NOT NULL,\n                    vendor TEXT,\n                    shipment_date TIMESTAMP WITH TIME ZONE,\n                    severity TEXT CHECK (severity IN ('Normal', 'High', 'Critical')),\n                    tracking_number TEXT,\n                    carrier TEXT,\n                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,\n                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP\n                );\n            "])))];
                case 2:
                    createTableError = (_e.sent()).error;
                    if (createTableError) {
                        console.error('Error creating shipmentlogs table:', createTableError);
                        throw createTableError;
                    }
                    console.log('Shipmentlogs table created successfully');
                    return [3 /*break*/, 4];
                case 3:
                    console.log('Shipmentlogs table already exists');
                    _e.label = 4;
                case 4: return [4 /*yield*/, supabase
                        .from('jobs')
                        .select('sap_data')
                        .limit(1)];
                case 5:
                    columnCheckError = (_e.sent()).error;
                    if (!((_b = columnCheckError === null || columnCheckError === void 0 ? void 0 : columnCheckError.message) === null || _b === void 0 ? void 0 : _b.includes('column "sap_data" does not exist'))) return [3 /*break*/, 9];
                    console.log('Adding sap_data column to jobs table...');
                    return [4 /*yield*/, supabase.rpc('alter_jobs_table', {
                            sql: 'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS sap_data JSONB DEFAULT \'[]\''
                        })];
                case 6:
                    alterError = (_e.sent()).error;
                    if (!alterError) return [3 /*break*/, 8];
                    return [4 /*yield*/, supabase
                            .from('jobs')
                            .update({ sap_data: '[]' })
                            .eq('id', -1)];
                case 7:
                    directAlterError = (_e.sent()).error;
                    if (directAlterError && !directAlterError.message.includes('does not exist')) {
                        console.error('Error adding sap_data column:', directAlterError);
                        throw directAlterError;
                    }
                    _e.label = 8;
                case 8:
                    console.log('sap_data column added successfully');
                    return [3 /*break*/, 10];
                case 9:
                    console.log('sap_data column already exists');
                    _e.label = 10;
                case 10:
                    // Check and create workcenters table
                    console.log('Checking workcenters table...');
                    return [4 /*yield*/, supabase
                            .from('workcenters')
                            .select('*')
                            .limit(1)];
                case 11:
                    workcentersCheckError = (_e.sent()).error;
                    if (!((_c = workcentersCheckError === null || workcentersCheckError === void 0 ? void 0 : workcentersCheckError.message) === null || _c === void 0 ? void 0 : _c.includes('does not exist'))) return [3 /*break*/, 15];
                    console.log('Creating workcenters table...');
                    return [4 /*yield*/, supabase
                            .from('workcenters')
                            .insert([{
                                name: 'TEST-WC',
                                type: 'Production',
                                status: 'Available',
                                utilization: 0
                            }])];
                case 12:
                    createError_1 = (_e.sent()).error;
                    if (!createError_1) return [3 /*break*/, 14];
                    console.log('Creating workcenters table through SQL...');
                    return [4 /*yield*/, supabase.rpc('exec_sql', {
                            query: "\n                        CREATE TABLE IF NOT EXISTS public.workcenters (\n                            id SERIAL PRIMARY KEY,\n                            name TEXT UNIQUE NOT NULL,\n                            type TEXT NOT NULL,\n                            status TEXT NOT NULL,\n                            utilization INTEGER NOT NULL DEFAULT 0,\n                            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,\n                            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP\n                        );\n\n                        -- Create trigger for workcenters\n                        CREATE TRIGGER update_workcenters_updated_at\n                            BEFORE UPDATE ON public.workcenters\n                            FOR EACH ROW\n                            EXECUTE FUNCTION update_updated_at_column();\n                    "
                        })];
                case 13:
                    sqlError = (_e.sent()).error;
                    if (sqlError) {
                        console.error('Error creating workcenters table:', sqlError);
                        throw sqlError;
                    }
                    _e.label = 14;
                case 14:
                    console.log('Workcenters table created successfully');
                    return [3 /*break*/, 16];
                case 15:
                    console.log('Workcenters table already exists');
                    _e.label = 16;
                case 16:
                    // Check and create NCRs table
                    console.log('Checking NCRs table...');
                    return [4 /*yield*/, supabase
                            .from('ncrs')
                            .select('*')
                            .limit(1)];
                case 17:
                    ncrsCheckError = (_e.sent()).error;
                    if (!((_d = ncrsCheckError === null || ncrsCheckError === void 0 ? void 0 : ncrsCheckError.message) === null || _d === void 0 ? void 0 : _d.includes('does not exist'))) return [3 /*break*/, 19];
                    console.log('Creating NCRs table...');
                    return [4 /*yield*/, supabase.rpc('exec_sql', {
                            query: "\n                    CREATE TABLE IF NOT EXISTS public.ncrs (\n                        id SERIAL PRIMARY KEY,\n                        ncr_number TEXT,\n                        job_number TEXT NOT NULL,\n                        work_order TEXT NOT NULL,\n                        operation_number TEXT NOT NULL,\n                        part_name TEXT NOT NULL,\n                        customer_name TEXT NOT NULL,\n                        equipment_type TEXT,\n                        drawing_number TEXT,\n                        issue_category TEXT,\n                        issue_description TEXT,\n                        root_cause TEXT,\n                        corrective_action TEXT,\n                        financial_impact DECIMAL(10,2) DEFAULT 0,\n                        planned_hours DECIMAL(10,2) DEFAULT 0,\n                        actual_hours DECIMAL(10,2) DEFAULT 0,\n                        status TEXT DEFAULT 'Submitted',\n                        pdf_report_url TEXT,\n                        drawing_url TEXT,\n                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,\n                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP\n                    );\n\n                    -- Create trigger for ncrs\n                    CREATE TRIGGER update_ncrs_updated_at\n                        BEFORE UPDATE ON public.ncrs\n                        FOR EACH ROW\n                        EXECUTE FUNCTION update_updated_at_column();\n                "
                        })];
                case 18:
                    sqlError = (_e.sent()).error;
                    if (sqlError) {
                        console.error('Error creating NCRs table:', sqlError);
                        throw sqlError;
                    }
                    console.log('NCRs table created successfully');
                    return [3 /*break*/, 20];
                case 19:
                    console.log('NCRs table already exists');
                    _e.label = 20;
                case 20:
                    console.log('Schema update completed successfully!');
                    return [3 /*break*/, 22];
                case 21:
                    error_1 = _e.sent();
                    console.error('Schema update failed:', error_1.message);
                    process.exit(1);
                    return [3 /*break*/, 22];
                case 22: return [2 /*return*/];
            }
        });
    });
}
console.log('Starting schema update...');
updateSchema();
var templateObject_1;
