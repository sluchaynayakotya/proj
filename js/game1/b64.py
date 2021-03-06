import base64
import mimetypes
import glob

input_path  = 'data/'
output_path = ''
filename    = 'Data'

files = [f for f in glob.glob(f'{input_path}**/*.*', recursive=True)]
with open(output_path + filename + '.js', 'w') as out:
    out.write('/* Generated by b64.py */\n')
    out.write('var ' + filename + ' = {\n')
    for file in files:
        mimetype = mimetypes.guess_type(file)[0]
        with open(file, 'rb') as f:
            data = base64.b64encode(f.read()).decode('utf-8')
        file = file.replace('\\', '/')
        out.write(f'  "{file}": "data:{mimetype};base64,{data}",\n')
    out.write('};\n')
