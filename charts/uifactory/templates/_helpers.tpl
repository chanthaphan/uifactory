{{- define "uifactory.name" -}}
{{- default "uifactory" .Values.nameOverride -}}
{{- end -}}

{{- define "uifactory.labels" -}}
app.kubernetes.io/name: {{ include "uifactory.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end -}}

{{- define "uifactory.apiImage" -}}
{{- printf "%s/%s:%s" .Values.image.registry .Values.image.apiRepository (.Values.image.tag | toString) -}}
{{- end -}}

{{- define "uifactory.frontendImage" -}}
{{- printf "%s/%s:%s" .Values.image.registry .Values.image.frontendRepository (.Values.image.tag | toString) -}}
{{- end -}}
