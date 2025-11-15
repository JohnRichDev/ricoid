export type FunctionExecutionStatus = 'success' | 'error' | 'skipped' | 'pending';
export type FunctionExecutionLogEntry = {
	name: string;
	args: any;
	status: FunctionExecutionStatus;
	result: any;
	sequence?: number;
	plannedOrder?: number;
};
