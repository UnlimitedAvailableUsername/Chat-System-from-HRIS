

DO $$
DECLARE
    target_emp_id bigint;
BEGIN
    -- Grab the first available employee ID
    SELECT user_id INTO target_emp_id FROM public.xin_employees LIMIT 1;

    IF target_emp_id IS NOT NULL THEN
        -- 1. Question about Remote Work
        INSERT INTO public.xin_employee_messages (employee_id, message, sender_type, is_read)
        VALUES (
            target_emp_id, 
            'Hi! I am planning my schedule for next month. Can you remind me how many days I am allowed to work remotely, and if there are any specific days I must be in the office?', 
            'employee', 
            false
        );

        -- 2. Question about PTO
        INSERT INTO public.xin_employee_messages (employee_id, message, sender_type, is_read)
        VALUES (
            target_emp_id, 
            'Hello HR, I would like to request some Paid Time Off for a family vacation. Does my PTO carry over to next year, and how far in advance do I need to submit the request?', 
            'employee', 
            false
        );

        -- 3. Question about Payroll
        INSERT INTO public.xin_employee_messages (employee_id, message, sender_type, is_read)
        VALUES (
            target_emp_id, 
            'Hi team, when is our next payout date? I want to make sure my payslip looks correct before it goes through.', 
            'employee', 
            false
        );
    END IF;
END $$;
