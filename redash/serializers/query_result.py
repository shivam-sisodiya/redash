import csv
import io
import xlsxwriter
from fpdf import FPDF
from dateutil.parser import isoparse as parse_date
from funcy import project, rpartial

from redash.authentication.org_resolving import current_org
from redash.query_runner import TYPE_BOOLEAN, TYPE_DATE, TYPE_DATETIME


def _convert_format(fmt):
    return (
        fmt.replace("DD", "%d")
        .replace("MM", "%m")
        .replace("YYYY", "%Y")
        .replace("YY", "%y")
        .replace("HH", "%H")
        .replace("mm", "%M")
        .replace("ss", "%S")
        .replace("SSS", "%f")
    )


def _convert_bool(value):
    if value is True:
        return "true"
    elif value is False:
        return "false"

    return value


def _convert_datetime(value, fmt):
    if not value:
        return value

    try:
        parsed = parse_date(value)
        ret = parsed.strftime(fmt)
    except Exception:
        return value

    return ret


def _get_column_lists(columns):
    date_format = _convert_format(current_org.get_setting("date_format"))
    datetime_format = _convert_format(
        "{} {}".format(
            current_org.get_setting("date_format"),
            current_org.get_setting("time_format"),
        )
    )

    special_types = {
        TYPE_BOOLEAN: _convert_bool,
        TYPE_DATE: rpartial(_convert_datetime, date_format),
        TYPE_DATETIME: rpartial(_convert_datetime, datetime_format),
    }

    fieldnames = []
    special_columns = dict()

    for col in columns:
        fieldnames.append(col["name"])

        for col_type in special_types.keys():
            if col["type"] == col_type:
                special_columns[col["name"]] = special_types[col_type]

    return fieldnames, special_columns


def serialize_query_result(query_result, is_api_user):
    if is_api_user:
        publicly_needed_keys = ["data", "retrieved_at"]
        return project(query_result.to_dict(), publicly_needed_keys)
    else:
        return query_result.to_dict()


def serialize_query_result_to_dsv(query_result, delimiter):
    s = io.StringIO()

    query_data = query_result.data

    fieldnames, special_columns = _get_column_lists(query_data["columns"] or [])

    writer = csv.DictWriter(s, extrasaction="ignore", fieldnames=fieldnames, delimiter=delimiter)
    writer.writeheader()

    for row in query_data["rows"]:
        for col_name, converter in special_columns.items():
            if col_name in row:
                row[col_name] = converter(row[col_name])

        writer.writerow(row)

    return s.getvalue()


def serialize_query_result_to_xlsx(query_result):
    output = io.BytesIO()

    query_data = query_result.data
    book = xlsxwriter.Workbook(output, {"constant_memory": True})
    sheet = book.add_worksheet("result")

    column_names = []
    for c, col in enumerate(query_data["columns"]):
        sheet.write(0, c, col["name"])
        column_names.append(col["name"])

    for r, row in enumerate(query_data["rows"]):
        for c, name in enumerate(column_names):
            v = row.get(name)
            if isinstance(v, (dict, list)):
                v = str(v)
            sheet.write(r + 1, c, v)

    book.close()

    return output.getvalue()

def serialize_query_result_to_pdf(query_result):
    query_data = query_result.data
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=10)
    
    # Limit to first 5 columns only
    all_columns = query_data["columns"] or []
    columns = all_columns[:5]
    column_names = [col["name"] for col in columns]
    
    if not column_names:
        # No columns, return empty PDF
        pdf_bytes = pdf.output(dest="S").encode("latin1")
        return pdf_bytes
    
    # Calculate column widths based on content
    # PDF page width is 210mm (A4), leave 20mm for margins (10mm each side)
    available_width = 190  # mm
    margin = 10  # mm
    
    # Calculate max width needed for each column
    # Check header names and sample data values
    column_widths = []
    sample_rows = query_data["rows"][:20]  # Check first 20 rows for width calculation
    
    for col_name in column_names:
        max_chars = len(str(col_name))  # Start with header length
        
        # Check data values in this column
        for row in sample_rows:
            v = row.get(col_name)
            if isinstance(v, (dict, list)):
                v = str(v)
            cell_text = str(v) if v is not None else ""
            max_chars = max(max_chars, len(cell_text))
        
        # Convert character count to mm (roughly 0.5mm per character for Arial size 9-10)
        # Add padding (4mm per column for borders and spacing)
        estimated_width = max_chars * 0.5 + 4
        column_widths.append(max(estimated_width, 25))  # Minimum 25mm per column
    
    # Normalize widths to fit available space
    total_width = sum(column_widths)
    if total_width > available_width:
        # Scale down proportionally
        scale_factor = available_width / total_width
        column_widths = [w * scale_factor for w in column_widths]
    else:
        # Distribute extra space evenly
        extra_space = available_width - total_width
        extra_per_column = extra_space / len(column_widths)
        column_widths = [w + extra_per_column for w in column_widths]
    
    # Ensure total width doesn't exceed available width (safety check)
    total_width = sum(column_widths)
    if total_width > available_width:
        # Final normalization to ensure exact fit
        scale_factor = available_width / total_width
        column_widths = [w * scale_factor for w in column_widths]
    
    # Set margins
    pdf.set_left_margin(margin)
    pdf.set_right_margin(margin)
    x_start = margin
    y_start = 10
    
    # Header row with background
    pdf.set_fill_color(220, 220, 220)  # Light gray background
    pdf.set_font("Arial", "B", 9)  # Bold for header, slightly smaller
    pdf.set_xy(x_start, y_start)
    
    for i, name in enumerate(column_names):
        # Use FPDF's get_string_width to accurately truncate header
        display_name = str(name)
        cell_width_mm = column_widths[i]
        max_text_width = cell_width_mm - 1  # Leave 1mm margin
        
        text_width = pdf.get_string_width(display_name)
        if text_width > max_text_width:
            # Truncate header to fit
            low = 0
            high = len(display_name)
            best_length = 0
            
            while low <= high:
                mid = (low + high) // 2
                test_text = display_name[:mid] + "..."
                test_width = pdf.get_string_width(test_text)
                
                if test_width <= max_text_width:
                    best_length = mid
                    low = mid + 1
                else:
                    high = mid - 1
            
            if best_length > 0:
                display_name = display_name[:best_length] + "..."
            else:
                display_name = "..."  # Column too narrow
        
        pdf.cell(column_widths[i], 7, display_name, border=1, fill=True, align="L")
    
    pdf.ln()
    y_pos = pdf.get_y()
    
    # Data rows
    pdf.set_font("Arial", size=8)  # Smaller font for data to fit more
    pdf.set_fill_color(255, 255, 255)  # White background
    
    row_height = 6  # Height per row
    
    for row_idx, row in enumerate(query_data["rows"]):
        # Check if we need a new page (leave space for header + 2 rows)
        if pdf.get_y() + row_height * 2 > 287:  # A4 height is 297mm, leave 10mm margin
            pdf.add_page()
            pdf.set_xy(x_start, y_start)
            # Redraw header on new page
            pdf.set_fill_color(220, 220, 220)
            pdf.set_font("Arial", "B", 9)
            for i, name in enumerate(column_names):
                # Use FPDF's get_string_width to accurately truncate header
                display_name = str(name)
                cell_width_mm = column_widths[i]
                max_text_width = cell_width_mm - 1  # Leave 1mm margin
                
                text_width = pdf.get_string_width(display_name)
                if text_width > max_text_width:
                    # Truncate header to fit
                    low = 0
                    high = len(display_name)
                    best_length = 0
                    
                    while low <= high:
                        mid = (low + high) // 2
                        test_text = display_name[:mid] + "..."
                        test_width = pdf.get_string_width(test_text)
                        
                        if test_width <= max_text_width:
                            best_length = mid
                            low = mid + 1
                        else:
                            high = mid - 1
                    
                    if best_length > 0:
                        display_name = display_name[:best_length] + "..."
                    else:
                        display_name = "..."  # Column too narrow
                
                pdf.cell(column_widths[i], 7, display_name, border=1, fill=True, align="L")
            pdf.ln()
            pdf.set_font("Arial", size=8)
            pdf.set_fill_color(255, 255, 255)
        
        pdf.set_x(x_start)
        
        for i, name in enumerate(column_names):
            v = row.get(name)
            if isinstance(v, (dict, list)):
                v = str(v)
            cell_value = str(v) if v is not None else ""
            
            # Use FPDF's get_string_width to accurately calculate text width
            # Truncate text to fit column width (leave 1mm margin)
            cell_width_mm = column_widths[i]
            max_text_width = cell_width_mm - 1  # Leave 1mm margin
            
            # Binary search to find the right truncation point
            text_width = pdf.get_string_width(cell_value)
            if text_width > max_text_width:
                # Truncate text to fit
                low = 0
                high = len(cell_value)
                best_length = 0
                
                # Binary search for the right length
                while low <= high:
                    mid = (low + high) // 2
                    test_text = cell_value[:mid] + "..."
                    test_width = pdf.get_string_width(test_text)
                    
                    if test_width <= max_text_width:
                        best_length = mid
                        low = mid + 1
                    else:
                        high = mid - 1
                
                if best_length > 0:
                    cell_value = cell_value[:best_length] + "..."
                else:
                    cell_value = "..."  # Column too narrow, just show ellipsis
            
            # Use cell with proper alignment
            pdf.cell(column_widths[i], row_height, cell_value, border=1, fill=False, align="L")
        
        pdf.ln()
    
    # Output as bytes
    pdf_bytes = pdf.output(dest="S").encode("latin1")  # FPDF returns str
    return pdf_bytes