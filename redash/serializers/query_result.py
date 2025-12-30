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


def serialize_query_result_to_dsv(query_result, delimiter, query=None):
    query_data = query_result.data if hasattr(query_result, 'data') else query_result
    # Get query name and timestamp
    query_name = None
    timestamp = None
    if query and hasattr(query, 'name'):
        query_name = query.name
    if hasattr(query_result, 'retrieved_at'):
        timestamp = query_result.retrieved_at
    return serialize_data_to_dsv(query_data, delimiter, query_name=query_name, timestamp=timestamp)


def serialize_data_to_dsv(query_data, delimiter, query_name=None, timestamp=None):
    """Serialize data dict directly to DSV format (CSV/TSV) without QueryResult object.
    
    :param query_data: Dictionary with 'rows' and 'columns' keys
    :param delimiter: Delimiter character (',' for CSV, '\t' for TSV)
    :param query_name: Optional query/report name to include in metadata
    :param timestamp: Optional timestamp of report generation
    """
    s = io.StringIO()
    writer = csv.writer(s, delimiter=delimiter)

    # Write metadata rows at the start
    if query_name is not None or timestamp is not None:
        writer.writerow(["TELANGANA STATE ROAD TRANSPORT CORPORATION"])
        if query_name:
            writer.writerow([query_name])
        if timestamp:
            # Format timestamp nicely
            if hasattr(timestamp, 'strftime'):
                timestamp_str = timestamp.strftime("%Y-%m-%d %H:%M:%S")
            else:
                timestamp_str = str(timestamp)
            writer.writerow([timestamp_str])
        writer.writerow([])  # Empty row separator

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
    query_data = query_result.data if hasattr(query_result, 'data') else query_result
    return serialize_data_to_xlsx(query_data)


def serialize_data_to_xlsx(query_data):
    """Serialize data dict directly to XLSX format without QueryResult object."""
    output = io.BytesIO()

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

def serialize_query_result_to_pdf(query_result, orientation="portrait", query=None):
    query_data = query_result.data if hasattr(query_result, 'data') else query_result
    # Get query name and timestamp
    query_name = None
    timestamp = None
    if query and hasattr(query, 'name'):
        query_name = query.name
    if hasattr(query_result, 'retrieved_at'):
        timestamp = query_result.retrieved_at
    return serialize_data_to_pdf(query_data, orientation=orientation, query_name=query_name, timestamp=timestamp)


def serialize_data_to_pdf(query_data, orientation="portrait", query_name=None, timestamp=None):
    """Serialize data dict directly to PDF format without QueryResult object.
    
    :param query_data: Dictionary with 'rows' and 'columns' keys
    :param orientation: 'landscape' or 'portrait' (default: 'portrait')
    :param query_name: Optional query/report name to include in metadata
    :param timestamp: Optional timestamp of report generation
    """
    rows = query_data.get("rows") or []
    columns_meta = query_data.get("columns") or []
    column_names = [c["name"] for c in columns_meta[:20]]

    # Determine page dimensions based on orientation
    if orientation == "portrait":
        PAGE_W, PAGE_H = 210, 297  # A4 portrait
        pdf_orientation = "P"
    else:
        PAGE_W, PAGE_H = 297, 210  # A4 landscape
        pdf_orientation = "L"

    if not column_names:
        pdf = FPDF(pdf_orientation)
        return pdf.output(dest="S").encode("latin1")

    # ------------------ CONFIG --------------------
    LEFT, RIGHT = 5, 5
    TOP, BOTTOM = 10, 10
    AVAILABLE_W = PAGE_W - LEFT - RIGHT

    MAX_LINES = 3                    # max lines per cell
    LINE_HEIGHT = 5                    # mm per line
    MAX_ROW_HEIGHT = MAX_LINES * LINE_HEIGHT  # 20mm

    MIN_COL_W = 25
    CHAR_MM = 0.5
    PAD = 1

    HEADER_FONT = ("Arial", "B", 8)
    DATA_FONT = ("Arial", "", 8)
    METADATA_FONT = ("Arial", "B", 12)
    METADATA_TITLE_FONT = ("Arial", "B", 10)

    # ------------- BUILD PDF ----------------------
    pdf = FPDF(pdf_orientation)
    pdf.add_page()
    pdf.set_left_margin(LEFT)
    pdf.set_right_margin(RIGHT)
    pdf.set_y(TOP)
    pdf.set_auto_page_break(auto=False)
    
    # Add metadata at the top (centered)
    current_y = TOP
    if query_name is not None or timestamp is not None:
        # Organization name (centered, bold, larger font)
        pdf.set_font(*METADATA_FONT)
        org_text = "TELANGANA STATE ROAD TRANSPORT CORPORATION"
        text_width = pdf.get_string_width(org_text)
        x_center = (PAGE_W - text_width) / 2
        pdf.set_xy(x_center, current_y)
        pdf.cell(text_width, 8, org_text, border=0, align="C")
        current_y += 10
        
        # Report title/name
        pdf.set_font(*METADATA_TITLE_FONT)
        if query_name:
            title_text = f"{query_name}"
        text_width = pdf.get_string_width(title_text)
        x_center = (PAGE_W - text_width) / 2
        pdf.set_xy(x_center, current_y)
        pdf.cell(text_width, 6, title_text, border=0, align="C")
        current_y += 8
        
        # Timestamp
        if timestamp:
            if hasattr(timestamp, 'strftime'):
                timestamp_str = timestamp.strftime("%Y-%m-%d %H:%M:%S")
            else:
                timestamp_str = str(timestamp)
            time_text = f"{timestamp_str}"
        text_width = pdf.get_string_width(time_text)
        x_center = (PAGE_W - text_width) / 2
        pdf.set_xy(x_center, current_y)
        pdf.cell(text_width, 6, time_text, border=0, align="C")
        current_y += 12  # Extra space before table
    
    # Set Y position for table
    pdf.set_y(current_y)

    # ------------- HELPERS -------------------------

    def wrap_to_lines(text, width_mm, font):
        """Wrap text into up to MAX_LINES lines, no padding; last line may get ellipsis."""
        pdf.set_font(*font)
        text = "" if text is None else str(text).replace("\n", " ")

        width_limit = width_mm - 3.5  # padding from borders
        lines = []
        remaining = text

        def fit_line(s):
            lo, hi = 0, len(s)
            best = 0
            while lo <= hi:
                mid = (lo + hi) // 2
                part = s[:mid]
                if pdf.get_string_width(part) <= width_limit:
                    best = mid
                    lo = mid + 1
                else:
                    hi = mid - 1
            return s[:best]

        for i in range(MAX_LINES):
            if not remaining:
                break

            # Last allowed line → add ellipsis if truncated
            if i == MAX_LINES - 1:
                lo, hi = 0, len(remaining)
                best = 0
                while lo <= hi:
                    mid = (lo + hi) // 2
                    part = remaining[:mid] + "..."
                    if pdf.get_string_width(part) <= width_limit:
                        best = mid
                        lo = mid + 1
                    else:
                        hi = mid - 1

                if best == 0:
                    lines.append("...")
                else:
                    sub = remaining[:best]
                    if best < len(remaining):
                        sub += "..."
                    lines.append(sub)
                break

            # Normal line
            chunk = fit_line(remaining)
            if not chunk:
                lines.append("...")
                break

            lines.append(chunk)
            remaining = remaining[len(chunk):]

        return lines

    def compute_widths():
        widths = []
        sample = rows[:10]

        for name in column_names:
            max_chars = max(
                [len(name)] +
                [len(str(r.get(name, ""))) for r in sample]
            )
            est = max(max_chars * CHAR_MM + PAD, MIN_COL_W)
            widths.append(est)

        total = sum(widths)

        if total > AVAILABLE_W:
            scale = AVAILABLE_W / total
            return [w * scale for w in widths]

        extra = AVAILABLE_W - total
        add = extra / len(widths)
        return [w + add for w in widths]

    def draw_row(text_values, widths, font, fill=False):
        """Draw one row with dynamic height based on wrapped content."""
        y_start = pdf.get_y()
        pdf.set_font(*font)

        # Wrap all cells first
        wrapped_cells = [wrap_to_lines(txt, w, font) for txt, w in zip(text_values, widths)]

        # Determine how many lines this row needs (min 1), cap at MAX_LINES
        line_counts = [max(1, min(len(lines), MAX_LINES)) for lines in wrapped_cells]
        max_lines_in_row = max(line_counts) if line_counts else 1
        row_height = min(max_lines_in_row * LINE_HEIGHT, MAX_ROW_HEIGHT)

        # Page break check WITH this dynamic row height
        if y_start + row_height + BOTTOM > PAGE_H:
            pdf.add_page()
            pdf.set_y(TOP)
            # redraw header on new page
            draw_row(column_names, widths, HEADER_FONT, fill=True)
            y_start = pdf.get_y()
            pdf.set_font(*font)

            # recompute wrapped because font might have changed, but we can reuse
            wrapped_cells[:] = [wrap_to_lines(txt, w, font) for txt, w in zip(text_values, widths)]
            line_counts[:] = [max(1, min(len(lines), MAX_LINES)) for lines in wrapped_cells]
            max_lines_in_row = max(line_counts) if line_counts else 1
            row_height = min(max_lines_in_row * LINE_HEIGHT, MAX_ROW_HEIGHT)

        # Draw each cell manually
        x = LEFT
        for lines, w in zip(wrapped_cells, widths):
            pdf.set_xy(x, y_start)
            pdf.rect(x, y_start, w, row_height)  # border rect

            # Draw lines of text inside the cell
            TEXT_PADDING = 1.5  # mm
            for idx, line in enumerate(lines[:MAX_LINES]):
                y_line = y_start + idx * LINE_HEIGHT
                if y_line + LINE_HEIGHT > y_start + row_height:
                    break
                pdf.set_xy(x + TEXT_PADDING, y_line)
                pdf.cell(w - 2 * TEXT_PADDING, LINE_HEIGHT, line, border=0)

            x += w

        pdf.set_y(y_start + row_height)

    # compute final column widths
    col_widths = compute_widths()

    # draw header
    draw_row(column_names, col_widths, HEADER_FONT, fill=True)

    # draw rows
    for r in rows:
        vals = [r.get(c, "") for c in column_names]
        draw_row(vals, col_widths, DATA_FONT)

    return pdf.output(dest="S").encode("latin1")
