import CodeEditor from "@uiw/react-textarea-code-editor";
import { Field } from "formik";
import { intl, T } from "src/locale";

interface Props {
	id?: string;
	name?: string;
	label?: string;
}
export function HaproxyConfigField({
	name = "advancedConfig",
	label = "haproxy-config.label",
	id = "advancedConfig",
}: Props) {
	return (
		<Field name={name}>
			{({ field }: any) => (
				<div className="mt-3">
					<label htmlFor={id} className="form-label">
						<T id={label} />
					</label>
					<CodeEditor
						language="haproxy"
						placeholder={intl.formatMessage({ id: "haproxy-config.placeholder" })}
						padding={15}
						data-color-mode="dark"
						minHeight={200}
						indentWidth={2}
						style={{
							fontFamily: "ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace",
							backgroundColor: "#222222",
							color: "#E6E6E6",
						}}
						{...field}
						value={field.value || ""}
						onChange={(e) => field.onChange(e)}
					/>
				</div>
			)}
		</Field>
	);
}
